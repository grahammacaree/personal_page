#!/usr/bin/env python3
"""Find the reMarkable on the LAN when its DHCP lease moves.

Order:
  1. Last successful host (cache file)
  2. Config hint (studies.config.json remarkable.wifiHost), if not \"auto\"
  3. remarkable.local (mDNS)
  4. USB gadget address 10.11.99.1
  5. Same /24 as this Mac: hosts with open TCP/22 that accept the
     RemarkableSync keyring password as root

Prints one host/IP to stdout on success; exits 1 if nothing works.
"""

from __future__ import annotations

import concurrent.futures
import ipaddress
import json
import socket
import sys
from pathlib import Path

CACHE = Path.home() / "Library/Application Support/remarkablesync/last_wifi_host.txt"
RMS_CONFIG = Path.home() / "Library/Application Support/remarkablesync/config.json"
KEYRING_SERVICE = "reMarkableSync"
KEYRING_USER = "reMarkable_ssh"
USB_HOST = "10.11.99.1"
MDNS_HOST = "remarkable.local"


def load_studies_hint(studies_config: Path) -> str:
    if not studies_config.is_file():
        return ""
    data = json.loads(studies_config.read_text())
    host = (data.get("remarkable") or {}).get("wifiHost") or ""
    host = str(host).strip()
    if host.lower() in {"", "auto", "discover"}:
        return ""
    return host


def load_password() -> str:
    try:
        import keyring
    except ImportError:
        return ""
    try:
        return keyring.get_password(KEYRING_SERVICE, KEYRING_USER) or ""
    except Exception:
        return ""


def tcp_open(host: str, port: int = 22, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def resolve_host(name: str, timeout: float = 2.0) -> str | None:
    try:
        socket.setdefaulttimeout(timeout)
        return socket.gethostbyname(name)
    except OSError:
        return None


def ssh_auth_ok(host: str, password: str, timeout: float = 4.0) -> bool:
    if not password:
        return False
    try:
        import paramiko
    except ImportError:
        return False

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=host,
            port=22,
            username="root",
            password=password,
            timeout=timeout,
            banner_timeout=timeout,
            auth_timeout=timeout,
            allow_agent=False,
            look_for_keys=False,
        )
        return True
    except Exception:
        return False
    finally:
        client.close()


def primary_ipv4() -> ipaddress.IPv4Address | None:
    """Best-effort: IP of the interface used for the default route."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return ipaddress.IPv4Address(s.getsockname()[0])
    except OSError:
        return None


def subnet_hosts(local: ipaddress.IPv4Address) -> list[str]:
    net = ipaddress.IPv4Network(f"{local}/24", strict=False)
    return [str(ip) for ip in net.hosts() if ip != local]


def scan_subnet(password: str) -> str | None:
    local = primary_ipv4()
    if local is None or local.is_loopback or local.is_link_local:
        return None

    hosts = subnet_hosts(local)
    open_ssh: list[str] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as pool:
        futures = {pool.submit(tcp_open, h): h for h in hosts}
        for fut in concurrent.futures.as_completed(futures):
            if fut.result():
                open_ssh.append(futures[fut])

    # Prefer quick password check — reMarkable root password is unique on LAN
    for host in sorted(open_ssh, key=lambda h: tuple(int(p) for p in h.split("."))):
        if ssh_auth_ok(host, password):
            return host
    return None


def write_cache(host: str) -> None:
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(host.strip() + "\n")
    # Keep RemarkableSync's own config in sync when present
    if RMS_CONFIG.is_file():
        try:
            cfg = json.loads(RMS_CONFIG.read_text())
            cfg["wifi_host"] = host
            cfg["connection_mode"] = "wifi"
            RMS_CONFIG.write_text(json.dumps(cfg, indent=2) + "\n")
        except Exception:
            pass


def candidates(hint: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def add(value: str) -> None:
        value = value.strip()
        if not value or value in seen:
            return
        seen.add(value)
        out.append(value)

    if CACHE.is_file():
        add(CACHE.read_text().strip())
    add(hint)
    add(MDNS_HOST)
    add(USB_HOST)
    return out


def is_ipv4(host: str) -> bool:
    try:
        ipaddress.IPv4Address(host)
        return True
    except ValueError:
        return False


def main() -> int:
    studies_config = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("studies.config.json")
    hint = load_studies_hint(studies_config)
    password = load_password()

    for host in candidates(hint):
        target = host if is_ipv4(host) else (resolve_host(host) or "")
        if not target:
            continue
        if not tcp_open(target):
            continue
        if password:
            if ssh_auth_ok(target, password):
                write_cache(target)
                print(target)
                return 0
        else:
            # No password yet — accept first reachable candidate
            write_cache(target)
            print(target)
            return 0

    if password:
        found = scan_subnet(password)
        if found:
            write_cache(found)
            print(found)
            return 0

    print("Could not discover reMarkable on the LAN.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
