#!/usr/bin/env python3
import sys
import re
import json

def main():
    if len(sys.argv) != 3:
        print("Usage: extract_json_dag.py <input_file> <output_file>")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Try to find ```json ... ``` block
        match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        
        if match:
            json_str = match.group(1)
        else:
            # If no code block, assume the whole file is JSON
            json_str = content
            
        # Validate that it is parseable JSON
        try:
            parsed = json.loads(json_str)
            if not isinstance(parsed, list):
                print("❌ Error: Extracted JSON is not a list/array.")
                sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"❌ Error: Invalid JSON extracted: {e}")
            sys.exit(1)
            
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(parsed, f, indent=2)
            
        print(f"✅ Successfully extracted JSON DAG to {output_file}")
        
    except FileNotFoundError:
        print(f"❌ Error: Input file {input_file} not found.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
