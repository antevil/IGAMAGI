import requests
from version import APP_VERSION

GITHUB_OWNER = "antevil"
GITHUB_REPO = "IGAMAGI"

LATEST_RELEASE_API = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"
RELEASES_PAGE = f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/releases"

def normalize_version(v: str) -> tuple[int, ...]:
    v = v.strip().lower()
    if v.startswith("v"):
        v = v[1:]
    parts = v.split(".")
    result = []
    for p in parts:
        try:
            result.append(int(p))
        except ValueError:
            result.append(0)
    return tuple(result)

def check_for_updates(timeout: int = 3) -> dict:
    """
    戻り値:
    {
        "ok": True/False,
        "update_available": True/False,
        "current_version": "1.0.0",
        "latest_version": "1.0.1",
        "html_url": "...",
        "message": "..."
    }
    """
    try:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "IGAMAGI"
        }
        res = requests.get(LATEST_RELEASE_API, headers=headers, timeout=timeout)
        res.raise_for_status()
        data = res.json()

        latest_tag = data.get("tag_name", "").strip()
        latest_url = data.get("html_url", RELEASES_PAGE)

        if not latest_tag:
            return {
                "ok": False,
                "update_available": False,
                "current_version": APP_VERSION,
                "latest_version": None,
                "html_url": RELEASES_PAGE,
                "message": "最新版情報を取得できませんでした。"
            }

        current = normalize_version(APP_VERSION)
        latest = normalize_version(latest_tag)

        has_update = latest > current

        return {
            "ok": True,
            "update_available": has_update,
            "current_version": APP_VERSION,
            "latest_version": latest_tag,
            "html_url": latest_url,
            "message": "新しいバージョンがあります。" if has_update else "このアプリは最新です。"
        }

    except requests.RequestException:
        return {
            "ok": False,
            "update_available": False,
            "current_version": APP_VERSION,
            "latest_version": None,
            "html_url": RELEASES_PAGE,
            "message": "更新確認に失敗しました。ネット接続を確認してください。"
        }