import os
import sys
import json
import urllib.request
import urllib.parse
import subprocess

PROJECT_ID = "2721694124152765276"

SCREENS = [
    ("1_comailer_logo", "d8648bc1e75a44ed86d77ee38b8e77f8"),
    ("2_dashboard_overview", "08b25eabd15943ac9133dbd8c72078e2"),
    ("3_login", "179648e57cdf4a5aa07977064502e7ed"),
    ("4_smtp_configs_senders", "1804cf448a884b1096e72599d2d6959c"),
    ("5_template_builder", "422eae4292764136bba642164f306893"),
    ("6_compose_send", "f924c8f3368243ac8ecce47de6b71beb"),
    ("7_analytics_logs", "6f8302c20c36430682f0c51450e8eeb8"),
]

def main():
    api_key = os.environ.get("STITCH_API_KEY")
    access_token = os.environ.get("STITCH_ACCESS_TOKEN")

    if not api_key and not access_token:
        print("Error: Please set STITCH_API_KEY or STITCH_ACCESS_TOKEN environment variable.")
        print("Example (PowerShell): $env:STITCH_API_KEY=\"your_key_here\"; python fetch_stitch_assets.py")
        sys.exit(1)

    output_dir = "stitch_assets"
    os.makedirs(output_dir, exist_ok=True)

    url = "https://stitch.googleapis.com/mcp"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-Goog-Api-Key"] = api_key
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    for name, screen_id in SCREENS:
        print(f"\n[+] Fetching metadata for {name} ({screen_id})...")
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "get_screen",
                "arguments": {
                    "name": f"projects/{PROJECT_ID}/screens/{screen_id}",
                    "projectId": PROJECT_ID,
                    "screenId": screen_id
                }
            }
        }

        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                
                if "error" in res_data:
                    print(f"[-] API Error for {name}: {res_data['error']}")
                    continue

                content = res_data.get("result", {}).get("content", [])
                screen_info = {}
                for item in content:
                    if item.get("type") == "text":
                        try:
                            screen_info = json.loads(item.get("text", "{}"))
                        except Exception:
                            pass

                # Fallback check
                if not screen_info:
                    screen_info = res_data.get("result", {})

                html_url = screen_info.get("htmlCode", {}).get("downloadUrl")
                img_url = screen_info.get("screenshot", {}).get("downloadUrl")

                if html_url:
                    html_path = os.path.join(output_dir, f"{name}.html")
                    print(f"    Downloading HTML -> {html_path}")
                    subprocess.run(["curl", "-L", html_url, "-o", html_path], check=False)

                if img_url:
                    img_path = os.path.join(output_dir, f"{name}.png")
                    print(f"    Downloading Screenshot -> {img_path}")
                    subprocess.run(["curl", "-L", img_url, "-o", img_path], check=False)

        except urllib.error.HTTPError as e:
            print(f"[-] HTTP Error {e.code}: {e.reason}")
        except Exception as e:
            print(f"[-] Error fetching {name}: {e}")

    print(f"\n[+] Completed! Assets saved in '{output_dir}/' folder.")

if __name__ == "__main__":
    main()
