#!/bin/bash
cd /Users/poliax/Documents/CodeX/chengze.online
echo "=== 部署到服务器 ==="
scp index.html css/style.css js/main.js ubuntu@124.221.150.160:/var/www/chengze.online/
ssh ubuntu@124.221.150.160 "sudo pm2 restart chengze"
echo "=== 完成 ==="
read -p "按回车退出"
