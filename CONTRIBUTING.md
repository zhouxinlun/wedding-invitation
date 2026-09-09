# 一起开发请柬

仓库：https://github.com/zhouxinlun/wedding-invitation 。这是私有仓库，代码和婚礼素材仅供受邀成员协作。

## 第一次启动

安装 Git、Node.js 22 或更高版本，以及微信开发者工具。网页预览另需 Python 3。

```sh
git clone https://github.com/zhouxinlun/wedding-invitation.git
cd wedding-invitation
npm run setup
npm test
```

`setup` 按锁文件安装云函数依赖。`test` 运行现有的九组检查脚本，覆盖请柬、地图、相册、祝福回复与删除、飘雪、云素材和合影动图；不访问真实祝福数据库，也不部署任何代码。

在微信开发者工具中导入仓库根目录，工具会读取 `project.config.json`。AppID 为 `wx0d45570c72a490e7`，云环境为 `wanshifuyue-d4ghbtrbi0e9bd01b`。GitHub 协作者权限与小程序权限分别管理：需要由小程序管理员把协作者的微信账号添加为项目开发者，才能验证真实云功能和预览。

查看网页版时，在仓库根目录执行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 http://127.0.0.1:8765/web/index.html 。相册和合影动图有随仓库保留的本地素材；网页祝福试览 `web/blessings-preview.html` 使用内存示例，真实投稿、回复和删除需要在小程序验证。

## 改哪里

| 内容 | 文件或目录 |
| --- | --- |
| 新人、婚礼时间、地点、流程、相册与影像配置 | `miniprogram/wedding.js` |
| 请柬主页面与样式 | `miniprogram/pages/invitation/` |
| 祝福投稿、回复、本人删除 | `miniprogram/components/blessings/` |
| 祝福接口、飘雪、相册等共享逻辑 | `miniprogram/shared/` |
| 合影动图 | `miniprogram/components/couple-motion/` |
| 祝福云函数及云素材固定清单 | `cloudfunctions/weddingBlessings/` |
| 网页页面、样式和交互 | `web/` |
| 自动检查 | `scripts/check*.js` |

小程序与网页有各自的模板和交互文件；改视觉或互动时同时查看两端。`wedding.js` 是婚礼内容的共享来源，避免另写一份不一致的信息。

## 分支协作

```sh
git switch main
git pull --ff-only
git switch -c feature/album-layout
# 修改后运行检查
npm test
git add <本次修改的文件>
git commit -m "优化相册布局"
git push -u origin feature/album-layout
```

然后在 GitHub 发起 Pull Request，互相查看改动后合入 `main`。每次推送和 PR 都会运行自动检查；工作流只检查代码，不会自动部署云函数或发布小程序。

## 素材与上线

- 原红色封面和 64 张相册照片已保留；不要覆盖原图或重新拟合人物。新的照片可以另外增加文件。原片清单记录的历史本机路径仅用于追溯，克隆运行不依赖这些路径。
- “我们”的双人招手动图已经接入；“一眼千年”的新娘敦煌视频仍等待最终成片。接入方法见 [FILM.md](FILM.md) 和 [COUPLE-MOTION.md](COUPLE-MOTION.md)。
- 小程序相册使用云端素材，网页版使用本地副本。新增素材按 [CLOUD-MEDIA.md](CLOUD-MEDIA.md) 同步，不要把有期限的签名链接写进代码。
- 真实亲友祝福、上传照片、原始 AI 视频、预览码、测试截图和本机凭据未纳入仓库。旧文档中的 `work/` 证据路径与预览码指向维护者本地文件；需要手机预览时在开发者工具重新生成。
- `project.private.config.json` 和 `.env` 留在本机。AppID、环境 ID 与固定云素材 ID 是项目配置，不是登录密钥。管理员身份配置保存在云端，不要复制到 Git。
- 云函数沿用现有环境变量与权限；`cloudbaserc.json` 不是线上环境变量的完整备份，不能据此覆盖已有管理员配置。云函数发布与手机验收参考 [BLESSINGS.md](BLESSINGS.md)，小程序审核与发布见 [PUBLISH.md](PUBLISH.md)。当前 GitHub 仓库建立并不代表小程序已正式上线。
