#!/usr/bin/env python3
import argparse
import sys
import xml.etree.ElementTree as ET

def extract_xml(content: str) -> str:
    start_idx = content.find("<PAGRL")
    if start_idx == -1:
        print("❌ Error: Could not find <PAGRL> tag in the file.")
        sys.exit(1)
    
    end_idx = content.rfind("</PAGRL>")
    if end_idx == -1:
        print("❌ Error: Could not find </PAGRL> tag in the file.")
        sys.exit(1)
    
    return content[start_idx:end_idx + 8]

def parse_xml(file_path: str) -> ET.Element:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        raw_xml = extract_xml(content)
        root = ET.fromstring(raw_xml)
        return root
    except Exception as e:
        print(f"❌ Error parsing XML: {e}")
        sys.exit(1)

def get_text(node: ET.Element, tag: str) -> str:
    child = node.find(tag)
    if child is not None and child.text is not None:
        return child.text.strip()
    return ""

def is_empty(node: ET.Element, tag: str) -> bool:
    child = node.find(tag)
    if child is None:
        return True
    
    # If the tag exists but has children (like <item>), it's not empty
    items = list(child)
    if len(items) > 0:
        return False
        
    # If there is text, check if it's only whitespace
    text = child.text
    if text and text.strip() and not text.strip().startswith("<!--"):
        return False
    return True

def validate_specify(root: ET.Element):
    if not is_empty(root, "MissingContextTerms"):
        print("❌ Validation failed: <MissingContextTerms> is not empty")
        return False

    if not is_empty(root, "UnresolvedAmbiguities"):
        print("❌ Validation failed: <UnresolvedAmbiguities> is not empty")
        return False

    if not is_empty(root, "AssumedValues"):
        print("❌ Validation failed: <AssumedValues> is not empty")
        return False

    decision = get_text(root, "Decision")
    if decision != "WriteSpec":
        print(f"❌ Validation failed: <Decision> must be WriteSpec, got {decision}")
        return False

    return True

def validate_design(root: ET.Element):
    if not is_empty(root, "UnjustifiedDecisions"):
        print("❌ Validation failed: <UnjustifiedDecisions> is not empty")
        return False

    decision = get_text(root, "Decision")
    if decision != "WriteDesign":
        print(f"❌ Validation failed: <Decision> must be WriteDesign, got {decision}")
        return False

    return True

def validate_tasks(root: ET.Element):
    if not is_empty(root, "UncreatedADRs"):
        print("❌ Validation failed: <UncreatedADRs> is not empty")
        return False

    schema_source = get_text(root, "DagSchemaSource")
    if schema_source.lower() == "memory":
        print("❌ Validation failed: <DagSchemaSource> cannot be 'memory'")
        return False

    decision = get_text(root, "Decision")
    if decision != "WriteJsonDag":
        print(f"❌ Validation failed: <Decision> must be WriteJsonDag, got {decision}")
        return False

    return True

def validate_quick_mode_entry(root: ET.Element):
    invoked = get_text(root, "UserExplicitlyInvokedQuickMode").lower()
    if invoked != "true":
        print("❌ Validation failed: <UserExplicitlyInvokedQuickMode> is not true")
        return False

    trigger = get_text(root, "TriggerPhrase")
    if trigger == "NONE" or not trigger:
        print("❌ Validation failed: <TriggerPhrase> cannot be NONE")
        return False

    return True

def validate_quick_mode_diagnosis(root: ET.Element):
    decision = get_text(root, "Decision")
    if decision != "Generate a Mini-DAG for the hot-patch.":
        print(f"❌ Validation failed: <Decision> expected 'Generate a Mini-DAG for the hot-patch.', got '{decision}'")
        return False

    return True

def main():
    parser = argparse.ArgumentParser(description="Validate PAGRL XML schema.")
    parser.add_argument("--phase", required=True, choices=["specify", "design", "tasks", "quick-mode-entry", "quick-mode-diagnosis"])
    parser.add_argument("xml_file", help="Path to the .pagrl.xml file")
    
    args = parser.parse_args()
    
    root = parse_xml(args.xml_file)
    
    # Check if the <PAGRL> tag actually has the correct phase attribute (lenient for diagnosis)
    phase_attr = root.get("phase")
    if phase_attr and args.phase in ["specify", "design", "tasks"]:
        if phase_attr.lower() != args.phase.lower():
            print(f"❌ Validation failed: PAGRL phase attribute '{phase_attr}' does not match expected '{args.phase}'")
            sys.exit(1)
            
    # Validate rules
    success = False
    if args.phase == "specify":
        success = validate_specify(root)
    elif args.phase == "design":
        success = validate_design(root)
    elif args.phase == "tasks":
        success = validate_tasks(root)
    elif args.phase == "quick-mode-entry":
        success = validate_quick_mode_entry(root)
    elif args.phase == "quick-mode-diagnosis":
        success = validate_quick_mode_diagnosis(root)
        
    if success:
        print(f"✅ PAGRL validation passed for phase: {args.phase}")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
