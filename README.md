# From-

一个仓库，两样东西，都是纯静态网页，没有后端、没有构建工具：

| 地址 | 是什么 |
| --- | --- |
| `https://<用户名>.github.io/<仓库名>/` | **个人主页** —— 杂志排版，项目卡片由 GitHub 资料自动生成 |
| `https://<用户名>.github.io/<仓库名>/quotes/` | **金句收藏夹** —— 手机上一键存句子的离线 PWA |

---

# 一、个人主页

首屏是刊头式的姓名与一句话简介，往下是从 GitHub 自动拉取的项目卡片
（鼠标划过会跟着倾斜）。跟随系统深浅色，开了「减弱动态效果」的话动效全部关闭。

## 改内容：只动 `assets/profile.js`

打开 `assets/profile.js`，里面一个 `SITE` 对象，每项都有注释。**两处必填**：

```js
name:    '你的名字',              // GitHub profile 里 name 是空的，先写在这
tagline: '写一句话介绍你自己……',   // 同上，bio 也是空的
```

其余（身份、所在地、邮箱、社交链接、刊头期号）按需填，留空就不显示。

## 会自动同步的部分

页面加载时会去拉 `api.github.com`，拿到什么就覆盖什么：

- 你在 GitHub profile 里填了 **name / bio** → 主页跟着变，`profile.js` 里的值退居兜底
- 新建了公开仓库 → 项目卡片自动多一张（fork、archived 的会被过滤，按 star 排序）
- 换了头像 → 主页头像跟着换

结果在浏览器本地缓存 6 小时（键 `site:gh:v1`），避开 GitHub 未登录接口
每小时 60 次的限流。**断网或限流时自动回退**到 `profile.js` 里的 `fallback` 快照，
页面不会变空白。

几个能微调的地方，都在 `SITE` 里：

- `hideRepos` —— 不想露面的仓库
- `linkOverrides` —— 某个仓库想链到别处（`From-` 默认链到站内的 `./quotes/`）
- `maxRepos` —— 最多显示几张卡片

## 显示字体

标题用 Google Fonts 上的 Instrument Serif。**不想要这个外部依赖的话**，删掉
`index.html` `<head>` 里那两行 `<link ...fonts.g...>` 即可 —— 字体栈会自动退回
系统衬线字体（Georgia / 宋体 / 思源宋体），排版依然成立。

中文本来就不走 Instrument Serif（它没有汉字），落的是系统宋体。

---

# 二、金句收藏夹（`/quotes/`）

读到好句子，手机上一键存下来。句子只存在你手机浏览器本地，不会上传到任何服务器；
装到主屏幕后断网也能打开。

## 长什么样

- 卡片式列表：正文、作者 / 出处、标签、想法、原文链接
- 搜索（正文 / 出处 / 作者 / 标签 / 想法，多关键词与匹配）、标签筛选、星标筛选
- 一键添加：Android 分享菜单、iOS 快捷指令、浏览器书签，三条路都通
- 自动去重、保存后可撤销
- 导出 JSON / Markdown，导入 JSON 合并

## 装到手机

用手机浏览器打开 `https://<你的地址>/quotes/`：

- **Android / Chrome**：菜单 → 「添加到主屏幕」或「安装应用」
- **iPhone / Safari**：分享按钮 → 「添加到主屏幕」

装完就是一个独立 App 图标，离线可用。

## 一键添加的三种方式

### 1. Android：系统分享菜单（最省事）

装到主屏幕后，在微信读书、浏览器、任意 App 里**选中文字 → 分享 → 金句收藏夹**，
句子直接入库，屏幕下方弹出「已收藏 · 撤销」。

分享内容里如果带着链接，会自动拆出来放进「链接」字段，页面标题会填进「出处」。

### 2. iPhone：快捷指令

「快捷指令」App → 新建 →

1. 添加操作 **「URL」**，内容填：
   `https://<你的地址>/quotes/?text=`
2. 添加操作 **「文本」**，内容选变量 **「快捷指令输入」**
3. 添加操作 **「URL 编码」**，对上一步的文本编码
4. 添加操作 **「合并文本」**，把第 1 步和第 3 步拼起来
5. 添加操作 **「打开 URL」**

然后在快捷指令的设置里打开 **「在共享表单中显示」**，接受类型选「文本」。
之后在任意 App 里选中文字 → 分享 → 这个快捷指令，句子就进来了。

### 3. 任意浏览器：书签小工具

打开 `/quotes/` → 右上角 ⚙️ → 复制那段 `javascript:` 代码 → 存成一个书签。
以后在网页上选中文字，点这个书签就存进来了，不打断阅读。

### 支持的 URL 参数

任何能拼 URL 的工具（快捷指令、Tasker、油猴脚本、Alfred……）都能接：

| 参数 | 说明 |
| --- | --- |
| `text` / `q` / `quote` | 正文（必填） |
| `title` | 页面标题，会填进「出处」 |
| `src` / `source` | 出处，优先于 `title` |
| `author` / `by` | 作者 |
| `tags` | 标签，逗号或空格分隔 |
| `url` / `link` | 原文链接 |
| `note` | 想法 |
| `auto` | `auto=0` 表示先弹编辑框再保存 |

例：

```
https://<你的地址>/quotes/?text=%E4%B8%80%E5%8F%A5%E8%AF%9D&author=%E7%8E%8B%E5%B0%94%E5%BE%B7
```

默认「分享进来就自动保存」，想每次都确认一下的话，在设置里关掉这个开关。

## 备份

数据存在浏览器的 `localStorage`（键名 `jinju:quotes:v1`）。
**清除浏览器数据会一并清掉**，换手机前记得进设置导出一份 JSON。

- 导出 JSON：完整备份，可再导入，按正文自动去重
- 导出 Markdown：适合贴进 Notion / Obsidian / 日记

---

# 三、从旧版升级

金句收藏夹原先住在站点根目录，现在挪到了 `/quotes/`，让位给个人主页。两件事已经
自动处理好了，你不用做什么：

- **旧的书签小工具 / iOS 快捷指令**（指向 `/?text=…`）继续可用 ——
  根目录的页面识别到 `text` 参数会自动转交给 `/quotes/`
- **已经装到手机上的旧 PWA** —— 根目录留了一个自毁 Service Worker，
  下次打开时会清掉旧缓存并注销自己，不会再盖住个人主页

只有一件事要手动做一次：**把金句 App 重新装一遍**。旧图标打开的还是根目录，
现在那儿是个人主页了。用手机浏览器打开 `/quotes/` 重新「添加到主屏幕」即可，
**句子不会丢** —— 数据存在浏览器里，跟装没装到主屏幕无关。

---

# 四、部署

仓库自带 GitHub Pages 工作流（`.github/workflows/pages.yml`），整个仓库当静态目录发布：

1. 仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**
2. 把代码推到 `main`，Actions 跑完后拿到地址

放到 Netlify、Vercel、自己的服务器上同样可以。

本地预览：

```bash
python3 -m http.server 8080     # 然后打开 http://127.0.0.1:8080
```

# 文件结构

```
index.html                个人主页（含旧链接的兼容跳转）
assets/profile.js         ★ 个人主页的全部内容，改这个就够了
assets/site.css           个人主页样式
assets/site.js            GitHub 拉取、3D 卡片、视差、滚动淡入
sw.js                     自毁 Service Worker，清理根目录的旧注册

quotes/index.html         金句收藏夹页面结构
quotes/assets/styles.css  样式（跟随系统深浅色）
quotes/assets/app.js      全部逻辑，原生 JS 无依赖
quotes/manifest.webmanifest   PWA 配置 + Android 分享目标
quotes/sw.js              Service Worker，离线缓存
quotes/icons/             应用图标
quotes/scripts/make-icons.py  重新生成图标（无第三方依赖）
```
