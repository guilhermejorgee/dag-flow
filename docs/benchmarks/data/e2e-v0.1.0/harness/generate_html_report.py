import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: generate_html_report.py <workspace_dir>")
        sys.exit(1)

    workspace_dir = sys.argv[1]
    scenarios = ["s1-auth-jwt", "s2-rbac-roles", "s3-file-upload", "s4-brownfield", "s5-ambiguous-spec", "s6-quick-mode-hotfix"]
    
    html = ["<html><head><title>E2E Benchmark Report</title>"]
    html.append("<style>")
    html.append("body { font-family: Arial, sans-serif; margin: 40px; background: #f9f9f9; color: #333; }")
    html.append("h1, h2 { color: #2c3e50; }")
    html.append(".scenario { background: #fff; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }")
    html.append(".passed { color: #27ae60; font-weight: bold; }")
    html.append(".failed { color: #c0392b; font-weight: bold; }")
    html.append("table { border-collapse: collapse; width: 100%; margin-top: 10px; }")
    html.append("th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }")
    html.append("th { background-color: #f2f2f2; }")
    html.append("</style></head><body>")
    
    html.append("<h1>E2E Benchmark Report</h1>")
    
    for s in scenarios:
        s_dir = os.path.join(workspace_dir, s)
        grade_file = os.path.join(s_dir, "grading.json")
        html.append(f"<div class='scenario'><h2>Scenario: {s}</h2>")
        
        if os.path.exists(grade_file):
            with open(grade_file) as f:
                grading = json.load(f).get("expectations", [])
                
            all_passed = all(g.get("passed", False) for g in grading)
            status = "<span class='passed'>PASSED</span>" if all_passed else "<span class='failed'>FAILED</span>"
            html.append(f"<p>Status: {status}</p>")
            
            html.append("<table><tr><th>Assertion</th><th>Evidence</th><th>Status</th></tr>")
            for g in grading:
                g_status = "<span class='passed'>PASS</span>" if g.get("passed") else "<span class='failed'>FAIL</span>"
                html.append(f"<tr><td>{g.get('text')}</td><td>{g.get('evidence')}</td><td>{g_status}</td></tr>")
            html.append("</table>")
        else:
            html.append("<p class='failed'>No grading.json found (did not complete).</p>")
            
        html.append("</div>")
        
    html.append("</body></html>")
    
    out_html = os.path.join(workspace_dir, "summary", "report.html")
    with open(out_html, "w") as f:
        f.write("\n".join(html))
        
    print(f"HTML report generated at: {out_html}")

if __name__ == "__main__":
    main()
