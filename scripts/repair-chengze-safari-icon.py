#!/usr/bin/env python3
"""Remove scoped Safari icon associations for the homepage or admin menus.

Run locally with Safari closed. Never alters icon artwork, icon image files,
icon_info, cookies, history, bookmarks, or unrelated page associations.
"""
import argparse
import datetime
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from urllib.parse import urlsplit

TARGET_URLS = tuple(
    scheme + '://' + host + ending
    for scheme in ('https', 'http')
    for host in ('www.chengze.online', 'chengze.online')
    for ending in ('', '/')
)


def target_urls(connection, scope):
    if scope == 'public':
        placeholders = ','.join('?' for _ in TARGET_URLS)
        return tuple(row[0] for row in connection.execute(
            'SELECT url FROM page_url WHERE url IN (' + placeholders + ')', TARGET_URLS))
    if scope != 'admin':
        raise ValueError('Unknown repair scope')
    candidates = connection.execute(
        "SELECT url FROM page_url WHERE url LIKE 'https://admin.chengze.online/%' OR url LIKE 'http://admin.chengze.online/%'")
    result = []
    for (url,) in candidates:
        parsed = urlsplit(url)
        if parsed.hostname != 'admin.chengze.online' or parsed.scheme not in ('http', 'https'):
            continue
        pathname = parsed.path.rstrip('/') or '/'
        if pathname in ('/', '/dashboard', '/admin/dashboard'):
            continue
        if pathname in ('/teach', '/teaching') or pathname.startswith(('/teach/', '/teaching/')):
            continue
        result.append(url)
    return tuple(result)


def repair(db_path, backup_dir, scope='public'):
    """Validate first; back up consistently; mutate only selected page rows."""
    db_path = Path(db_path)
    if not db_path.is_file():
        raise RuntimeError('没有找到 Safari 图标数据库；未修改任何数据。')
    # mode=rw prevents accidentally creating a new empty database.
    connection = sqlite3.connect(db_path.resolve().as_uri() + '?mode=rw', uri=True, timeout=5)
    try:
        columns = {row[1] for row in connection.execute('PRAGMA table_info(page_url)')}
        if not {'url', 'uuid'}.issubset(columns):
            raise RuntimeError('Safari 数据库结构与预期不同；未修改任何数据。')
        urls = target_urls(connection, scope)
        count = len(urls)
        if not count:
            return 0, None
        if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
            raise RuntimeError('图标数据库检查未通过；未修改任何数据。')
        backup_dir = Path(backup_dir)
        backup_dir.mkdir(mode=0o700, parents=False, exist_ok=False)
        backup = backup_dir / 'Favicons.db'
        with sqlite3.connect(str(backup)) as destination:
            connection.backup(destination)
        os.chmod(backup, 0o600)
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            # Some Safari versions also remember failed icon loads per page.
            rejected_columns = {row[1] for row in connection.execute('PRAGMA table_info(rejected_resources)')}
            for start in range(0, len(urls), 400):
                batch = urls[start:start + 400]
                placeholders = ','.join('?' for _ in batch)
                connection.execute('DELETE FROM page_url WHERE url IN (' + placeholders + ')', batch)
                if 'page_url' in rejected_columns:
                    connection.execute('DELETE FROM rejected_resources WHERE page_url IN (' + placeholders + ')', batch)
        return count, backup
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='只检查结构与目标记录数，不修改数据')
    parser.add_argument('--site', choices=('public', 'admin'), default='public', help='public=官网首页；admin=后台菜单，保留控制台与教师端')
    args = parser.parse_args()
    safari = subprocess.run(['/usr/bin/pgrep', '-x', 'Safari'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if safari.returncode == 0:
        print('请先按 ⌘Q 完全退出 Safari，再运行本工具。当前没有修改任何数据。')
        return 2
    folder = Path.home() / 'Library' / 'Safari'
    db = folder / 'Favicon Cache' / 'Favicons.db'
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    try:
        if args.check:
            connection = sqlite3.connect(db.resolve().as_uri() + '?mode=ro', uri=True)
            try:
                columns = {row[1] for row in connection.execute('PRAGMA table_info(page_url)')}
                if not {'url', 'uuid'}.issubset(columns):
                    raise RuntimeError('数据库结构与预期不同。')
                count = len(target_urls(connection, args.site))
                print('所选页面图标关联记录数：' + str(count) + '；没有修改任何数据。')
            finally:
                connection.close()
            return 0
        count, backup = repair(db, folder / ('chengze-favicon-' + args.site + '-backup-' + stamp), args.site)
    except (OSError, sqlite3.Error, RuntimeError) as error:
        print('未能完成修复：' + str(error))
        print('若提示权限不足，这是 macOS 对 Safari 目录的隐私保护；本工具不会尝试绕过。')
        return 1
    if not count:
        print('没有找到匹配的旧关联，未修改数据；需要继续诊断，不能视为已修复。')
        return 3
    label = '官网首页' if args.site == 'public' else '管理后台菜单（保留控制台与教师端）'
    print('已移除' + label + '的 ' + str(count) + ' 条图标关联。其他网站、登录信息和历史记录未改动。')
    print('一致性备份：' + str(backup))
    url = 'https://www.chengze.online/' if args.site == 'public' else 'https://admin.chengze.online/'
    print('请重新打开 Safari，访问 ' + url + ' 并检查相关页面；若仍异常，不要重复运行。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
