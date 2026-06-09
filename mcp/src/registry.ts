import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Fuse from 'fuse.js'
import matter from 'gray-matter'
import { z } from 'zod'

import { CACHE_TTL_MS, GLOBAL_SKILLS_PATH, LOCAL_SKILLS_PATH, SKILL_MAIN_FILE } from './constants'
import type { Indexes, IndexSkill, Registry, RegistryCache, SkillEntry } from './types'

import { extractTriggers } from './utils'

let cache: RegistryCache | null = null

function resolvePath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2))
  }
  return path.resolve(p)
}

async function scanSkillsDir(dirPath: string): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = []
  const resolvedDir = resolvePath(dirPath)

  try {
    const entries = await fs.readdir(resolvedDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillName = entry.name
      const skillPath = path.join(resolvedDir, skillName)
      const mainFilePath = path.join(skillPath, SKILL_MAIN_FILE)

      try {
        const content = await fs.readFile(mainFilePath, 'utf-8')
        const { data } = matter(content)

        // Find all files in the skill directory to populate `files` array
        const allFiles: string[] = []
        async function walk(currentPath: string, relativeRoot: string) {
          const items = await fs.readdir(currentPath, { withFileTypes: true })
          for (const item of items) {
            const relPath = path.join(relativeRoot, item.name)
            if (item.isDirectory()) {
              await walk(path.join(currentPath, item.name), relPath)
            } else {
              allFiles.push(relPath)
            }
          }
        }
        await walk(skillPath, '')

        skills.push({
          name: data.name || skillName,
          description: data.description || 'No description provided.',
          category: data.category || 'Uncategorized',
          path: skillPath,
          files: allFiles,
          author: data.author,
          version: data.version,
          contentHash: 'local-file',
        })
      } catch (err) {
        process.stderr.write(`[registry] skipped ${skillName}: ${err instanceof Error ? err.message : String(err)}\n`)
      }
    }
  } catch (err) {
    process.stderr.write(`[registry] Directory ${resolvedDir} not found or inaccessible.\n`)
  }

  return skills
}

export async function getRegistry(): Promise<Registry> {
  const now = Date.now()

  if (cache !== null && now - cache.fetchedAt < CACHE_TTL_MS) {
    process.stderr.write('[registry] cache hit (within TTL)\n')
    return cache.data
  }

  process.stderr.write('[registry] scanning local skill directories...\n')

  const globalSkills = await scanSkillsDir(GLOBAL_SKILLS_PATH)
  const localSkills = await scanSkillsDir(LOCAL_SKILLS_PATH)

  const skillMap = new Map<string, SkillEntry>()
  for (const s of globalSkills) skillMap.set(s.name, s)
  for (const s of localSkills) skillMap.set(s.name, s)

  const skills = Array.from(skillMap.values())

  const data: Registry = {
    version: 'local',
    categories: {},
    skills,
    deprecated: [],
  }

  cache = { data, fetchedAt: now }
  process.stderr.write(`[registry] loaded ${skills.length} skills from disk.\n`)
  return cache.data
}

export function buildIndexes(registry: Registry): Indexes {
  const slimSkills: IndexSkill[] = registry.skills.map((skill) => {
    const desc = skill.description

    let usageHint: string
    const useWhenIdx = desc.indexOf('Use when')

    if (useWhenIdx > 0) {
      usageHint = desc.slice(0, useWhenIdx).trim()
    } else {
      const dotIdx = desc.indexOf('.')
      usageHint = dotIdx >= 0 ? desc.slice(0, dotIdx).trim() : desc.trim()
    }

    return {
      name: skill.name,
      description: desc,
      usage_hint: usageHint,
      category: skill.category,
      triggers: extractTriggers(desc),
    }
  })

  const fuse = new Fuse(slimSkills, {
    keys: [
      { name: 'name', weight: 0.45 },
      { name: 'triggers', weight: 0.3 },
      { name: 'description', weight: 0.2 },
      { name: 'category', weight: 0.05 },
    ],
    threshold: 0.4,
    includeScore: true,
    useExtendedSearch: true,
    minMatchCharLength: 2,
  })

  const map = new Map<string, SkillEntry>(registry.skills.map((s) => [s.name, s]))
  return { fuse, map }
}
