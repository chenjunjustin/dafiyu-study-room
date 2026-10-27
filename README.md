# 大肥鱼自习室 · Demo v1

一个本地优先的学习空间 Demo。当前版本只保留四个核心：Live2D 桌宠、专注、日程、对话。
花园功能暂不进入 v1；番茄种子和统计保留在首页与专注罐中。

## 本地启动

```bash
cd demo
node local-server.mjs
```

打开 `http://127.0.0.1:4173`。

如果系统 PATH 中没有 `node`，可以使用当前环境提供的运行时：

```bash
/Users/a0000/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node local-server.mjs
```

## 可选：接入真实 DeepSeek

没有 Key 时，对话会使用本地中文指令理解，所有写入仍需要点确认卡。

接入真实模型时：

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
node local-server.mjs
```

也可以直接打开页面右侧对话舱的钥匙按钮，在配置页填入 Key。验证通过后，Key 只保存在当前标签页的 `sessionStorage`，用于同源 API 代理请求；不会写入仓库、localStorage 或导出文件，关闭标签页后失效。

不要提交 `.env`、API Key 或任何真实密钥。部署到 Vercel 时，页面输入框仍可使用；也可以在 Vercel 环境变量中配置 `DEEPSEEK_API_KEY` 作为可选的服务端回退。

## 可以怎么试

- 单击桌宠头部会摸头，点身体会逗她；双击进入自拍，右键可打开快捷动作菜单。
- Live2D 会跟随鼠标视线，鼠标静止后自动环视；模型可拖拽换位置，滚轮可缩放。
- 表情面板完整还原模型原作的 44 组参数交互：表情、装饰、场景、动作四页，外加 8 个动作文件。
- 支持兔耳/猫耳贴纸、四款眼镜、花转、发箍、单边马尾、头顶鲸、深色桌布、巴菲、魔爪、手机、点菜板、蛋包饭等。
- 表情和道具直接驱动 Live2D 参数并叠加短暂符号反馈，不再只是聊天框文字；一次性动作结束会自动清理姿势。
- 首屏右侧就是常驻对话舱；移动端点底部「大肥鱼」回到对话。
- 对话舱右上角可改称呼、发表情/表情包、切换对话窗口、接入 DeepSeek API。
- 对话头部可以：
  - 新建独立上下文；
  - 切换已有对话；
  - 清空当前上下文；
  - 清理其他旧对话；
  - 编辑人设预设提示词。
- 左侧齿轮打开统一设置，可管理人设与“主动搭话”。
- 主动搭话默认开启：每 5 分钟做一次本地检查，先做 35% 概率掷骰；通过后才调用模型主动开口。间隔（3/5/10/15/30 分钟）和概率（10–90%）都可调整，23:00–08:00 静默，未回复上一条主动消息时不会连续追问。
- AI 可以自行选择 Live2D 表情和表情包；用户也能从表情面板手动发送。
- AI 回复还可以自行选择 Live2D 动作和临时装饰/场景，用角色动作配合聊天情绪表达。
- AI 可通过结构化 action 创建、修改、删除日程，创建/取消专注计划，开始专注；全部写入都先显示确认卡。
- 聊天是主场景，日程/专注属于按需技能，需要用户明确要求才会生成 action。
- 对话栏左侧边缘可拖拽调整宽度。
- 最左侧专注按钮会直接开始计时，并把“我开始努力干活啦，大肥鱼”发给当前对话。
- 在首页点「就做这件」直接开始专注；刷新页面后计时会按真实时间恢复。
- 在日程里切换日/周视图，点任务编辑，点右上角加号新建。
- 在对话里输入：
  - `明天下午3点写论文1小时`
  - `删除写论文`
  - `做一个专注计划：写论文2轮，复习英语1轮`
  - `帮我拆一下今天要做的事`
  - `开始25分钟专注`

AI 生成的所有日程/计划操作都会先显示确认卡。删除需要二次确认，确认后还可以撤销。

## 数据与范围

- 数据保存在浏览器 localStorage，仅当前浏览器可见。
- 每个对话本地保留最近 80 条记录，页面展示最近 50 条；发送给模型的上下文是最近 30 条真实聊天，表情/表情包记录不会占用记忆额度。
- 清除站点数据会重置 Demo；刷新页面不会清空。
- P0 Demo 不包含花园、语音、登录、云同步或原生 App。
- 刷新后想恢复初始示例数据，可打开 `http://127.0.0.1:4173/?reset=1`。

## Vercel 部署

- 项目根目录就是本 `demo` 目录。
- `api/` 提供 Vercel Serverless 接口：`chat.js`、`status.js`、`persona.js`、`config.js`。
- 页面内输入的 Key 会随请求发送到同源 Serverless 代理，不会写进 GitHub 或构建产物。
- 可选服务端回退：在 Vercel Environment Variables 中设置 `DEEPSEEK_API_KEY`；也可设置 `DEEPSEEK_MODEL` 与 `DEEPSEEK_BASE_URL`。
- 若部署公开可访问，建议在 Vercel 中启用 Deployment Protection，避免 API 额度被陌生访客消耗。

## Live2D 素材与署名

Live2D 运行时与模型已放在 `assets/live2d` 和 `assets/vendor`：

- 角色原作「溟月」：上善无形
- DeepSeek 女仆鲸鱼娘二创：ZipZipPipe
- Live2D 模型：氵六青
- 模型参考仓库：`Andersen216/dsh-whale-girl-live2d`
- 模型素材许可：`CC BY-NC-SA 4.0`，仅个人非商业使用
- 代码参考：MIT；Live2D Cubism Core 按其可再分发条款使用

完整来源与许可说明见 `assets/live2d/PROVENANCE.md`、`assets/live2d/AUTHORS.md` 和 `assets/live2d/LICENSE`。
「大肥鱼 / DeepSeek 鲸鱼娘」为社区二创形象，本项目不是 DeepSeek 官方产品。

全量互动清单与参数映射参考原作者项目
[`Andersen216/dsh-whale-girl-live2d`](https://github.com/Andersen216/dsh-whale-girl-live2d)
的 `docs/作者按键表-对照.md`；本项目只复用本地模型已有的参数，不额外分发新模型文件。

## 大肥鱼人设来源

角色人设原文来自：

- GitHub：`ERUIHNIYHBKBNF/dafeiyu-persona`
- 文件：`dafeiyu/SKILL.md`、`dafeiyu/references/lines.md`、`dafeiyu/references/lore.md`
- 许可：MIT

原文保存在 `personas/dafeiyu/`，未改写其角色设定与说话风格。自习室的数据确认、工具边界和安全规则在 `local-server.mjs` 中作为独立应用规则拼在 persona 之后加载。

API 请求中的人设作为第一条 system message 原样发送；单独的第二条 system message 只定义 JSON / action 接口，不再加入额外角色语气。

对话窗口菜单中的「编辑预设提示词」可覆写默认人设；保存后只存在本机 localStorage，并可一键恢复下载原版。

另提供一套来自 AstrBot 社群的“AstrBot 真人感”预设：

- GitHub：`whyever77/dafeiyu-astrbot`（73 stars，MIT）
- 文件：`persona/大肥鱼-人格.md`（v2.1 黏人修订）
- 本 Demo 中的原样副本：`assets/personas/dafeiyu-astrbot.md`

两套预设都可在人设编辑器中切换、继续手改并保存为自定义。AstrBot 原版包含其平台工具与主动消息语境，本 Demo 实际的日程工具仍由独立接口协议约束。

## 表情包与头像

精选表情包和聊天头像位于 `assets/stickers/`，来源与署名见 `assets/stickers/SOURCE.md`。仅用于本地个人 Demo。
