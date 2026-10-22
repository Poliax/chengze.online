#!/bin/zsh
cd -- "${0:A:h}" || exit 1
echo '本工具只重建承泽在线官网首页的 Safari 图标关联，并先保存备份。'
echo '请先完全退出 Safari；不会清理所有网站缓存。'
/usr/bin/python3 scripts/repair-chengze-safari-icon.py
repair_status=$?
echo
read -r '?按回车关闭此窗口。'
exit "$repair_status"
