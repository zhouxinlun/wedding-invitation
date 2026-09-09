# 玫瑰藤蔓 · 十款设计

十张独立植物装饰：暗红玫瑰、鼠尾草绿叶、香槟细金藤。不是同一张素材的十次镜像。每张均为真实透明底，保留在照片之间的空隙；继续使用原来的逐段展开与轻摆，减少动态效果时静态显示。

原生主页面、分包相册和Web预览统一使用 shared/rose-vines.js。按照相册标识进行种子洗牌，每轮十种各用一次，下一轮首款避开上一轮末款；同一本相册重新打开仍保持顺序。相册不足十处连接时使用其中不重复的一部分，最后一张后无装饰。主页面封面使用独立序列。装饰不接收点击，不进入放大/分享照片数组，也不增加存储或网络请求。

使用内置图像生成工具逐款生成，未调用CLI或Kling。首次带参考图的结果把棋盘格画成了背景，已弃用；交付结果均通过RGBA透明通道检查。生成后只进行常规尺寸缩小与PNG调色板压缩，没有修改婚纱照。十款660×220 PNG合计255095字节，主包约1.46MB，保持低于2MB限制。

素材目录：`miniprogram/assets/rose-vines/`。设计总览：`web/rose-vines-preview.html`。连续相册：`web/album-preview.html?group=heart`。生成原件与本次改动前备份：`../work/invitation-ten-vines/originals`、`../work/invitation-ten-vines/before`。

|编号|设计|素材|大小|
|---|---|---|---|
|01|月弧相拥|miniprogram/assets/rose-vines/vine-01.png|27883 bytes|
|02|双环心结|miniprogram/assets/rose-vines/vine-02.png|33322 bytes|
|03|斜枝寄语|miniprogram/assets/rose-vines/vine-03.png|23487 bytes|
|04|花瀑轻垂|miniprogram/assets/rose-vines/vine-04.png|23937 bytes|
|05|心形花笺|miniprogram/assets/rose-vines/vine-05.png|22383 bytes|
|06|回旋圆舞|miniprogram/assets/rose-vines/vine-06.png|32270 bytes|
|07|并蒂相依|miniprogram/assets/rose-vines/vine-07.png|20924 bytes|
|08|疏影留白|miniprogram/assets/rose-vines/vine-08.png|11694 bytes|
|09|花束长卷|miniprogram/assets/rose-vines/vine-09.png|28628 bytes|
|10|蝶吻玫瑰|miniprogram/assets/rose-vines/vine-10.png|30567 bytes|

完整最终提示词（每款独立调用内置工具）：

### 01 月弧相拥

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. A broad low crescent/U sweep with one open burgundy rose at the lowest middle, one tiny rosebud near each ascending endpoint. Sweeping arc occupies almost the full width, open upper center. It must NOT have the reference's large left flower or identical placement. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 02 双环心结

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. An airy horizontal infinity knot: two large loose champagne-gold loops cross only once at the center, with a burgundy rose at the outer lower left, a second at the upper right, and one minute bud at the crossover. Curves are continuous, graceful, not a rigid mathematical symbol. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 03 斜枝寄语

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. A single elegant diagonal vine travelling from lower left to upper right in one long rising S sweep, one open burgundy rose near the lower-left quarter, two small buds near the upper-right end. Fine gold curling offshoots create a graceful sloping silhouette. No U-shaped garland. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 04 花瀑轻垂

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. An almost horizontal fine gold vine across the upper middle with THREE slender drooping tendrils hanging below at different lengths. A burgundy rose hangs at the longest left-of-center tendril, tiny burgundy buds at the other two. Graceful waterfall silhouette with lots of negative space; delicate asymmetrical botanical chandelier, not a dense row of flowers. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 05 心形花笺

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. Two fine gold stems curl together into ONE low wide OPEN HEART outline in the center, tips trail outward to both canvas sides. Two modest burgundy roses grow at the left and right shoulders of the heart. Hollow transparent middle. Thin wistful botanical heart, never thick or cartoonish. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 06 回旋圆舞

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Fine champagne-gold curling vines, dark burgundy red roses, small sage green leaves, refined antique botanical engraving. A distinctive single large inward gold spiral on the left half of the wide composition, flows into a long soft wave toward the right edge. One burgundy rose nestles at the open spiral center, a second small side-view rose near the right third. Fine small spiralling tendrils, asymmetrical airy movement. Not a U or infinity shape. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas.

### 07 并蒂相依

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. TWO slender gold stems entwine loosely like a double helix, with TWO equally sized open burgundy roses leaning together at the middle, delicate leaves and tiny buds only near the outer tails. Stems separate into long opposing curling flourishes at both ends. Intimate paired blossoms, horizontal composition. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 08 疏影留白

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. The sparsest composition: a long almost horizontal threadlike gold stem makes three shallow gentle waves, decorated only with FOUR very tiny burgundy rosebuds and a few narrow sage leaves scattered unevenly. NO large open rose. Plenty of transparent space and fine curled tip endings, airy and quiet. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 09 花束长卷

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. A modest asymmetric cluster of THREE deep burgundy roses with sage leaves concentrated at the LEFT quarter, from which TWO long gold stems travel and curl across the remaining canvas toward the far right, ending in a small bud. Bouquet-to-scroll silhouette: textured flowers on left balanced by pure delicate calligraphic vines on right. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

### 10 蝶吻玫瑰

> Create a transparent-background PNG botanical wedding divider, width-to-height ratio 3:1. Dark burgundy red roses, small muted sage green leaves, fine slender champagne-gold stems and curling tendrils. Refined antique botanical engraving, realistic softly painted petals, very airy and elegant, not chunky sculpted metal. A broad sweeping gold S vine with two small burgundy roses, one near each outer third, and TWO tiny graceful butterflies with champagne-gold outlined wings hovering near the open central gap, all visually joined as one botanical ornament. Butterfly detail is subtle like engraved jewelry, rose petals detailed, no large central bloom. Isolated cutout with actual alpha transparency. No checkerboard, no background texture, no backdrop color, no text. All petals fully inside canvas with 5% clear margins. Fine stems legible when image is 340px wide.

此次只更新本地项目、输出归档与微信预览码，不替换1.3.0开发上传版，不提交审核或正式发布。
