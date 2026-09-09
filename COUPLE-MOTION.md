# 我们 · 微笑招手合影

原白纱合照 `miniprogram/assets/couple-white.jpg` 生成自然微笑与轻轻招手，保留双人婚纱合影、固定镜头和拱形展示。原图仍作为底图，轻触可放大原照片。

可灵模型 `kling-video-v3_0_turbo`，一次5秒1080p任务，消耗50积分。生成ID：`AXyeQ54Cgx06D7ImUylCBjPr_0jl_k3U0sdnASZXJQPSYG_5WaRfT3AnugEf1BBW7bI6CKbu`。主素材已下载保留在项目外 `work/us-wave/couple-wave-master.mp4`，不依赖24小时结果链接。经逐段取帧检查两人面部、手势及构图。

本地用正放接反放收手，移除衔接处重复帧，输出10秒循环。无音轨，H.264/yuv420p，720×1080，24fps，faststart，651790字节；SHA256 `a71e12da2ca0165da5e53230cf3315585bf936c0123f794f90bc8ee923c8a28b`。GIF另存为 `exports/我们-微笑招手.gif`，网页及小程序用更轻的MP4。

小程序 `components/couple-motion` 负责入屏播放、离屏与页面后台暂停、首帧淡入、失败回到原图、点击重试及签名过期更新；loadedmetadata 就绪后补发播放指令，避免重建播放器时丢失早到的 play()。原图作为独立底层，不使用只支持网络地址的原生video poster属性。页面已有影像/隐私浮层打开时暂停。

Web 对应 `web/couple-motion.js` 与 `web/media/couple-wave.mp4`，静音、循环、playsinline、入屏加载；页面隐藏、已有对话框和系统减少动态效果时暂停。浏览器拒绝自动播放时保留原照片。Web本轮未进行可视化验收。

云文件在已绑定环境 `wanshifuyue-d4ghbtrbi0e9bd01b` 的 `wedding-media/motion/<sha256>.mp4`；只由服务端 `motion.json` 配置。`weddingBlessings` 的 `usMotion` 动作校验微信云身份和正式AppID，返回一小时签名。客户端不传可签名文件ID；不修改存储权限、相册照片或祝福记录。

本地61组检查通过，含动图资源签名、入屏与生命周期、失败重试。真实微信云下载HTTP200且字节哈希一致；微信开发者工具实际播放与离屏暂停、返回续播已验证。新娘敦煌视频仍等待用户提供，此合影动图不替代“一眼千年”。

手机预览：`exports/正式账号-合影动图-预览码.jpg`；官方总包1506778字节、主包1505184字节。正式代码上传、提审与发布未由本轮执行。手机端解码、移动网络与手势仍以真机预览验收为准。
