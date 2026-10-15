# PokerChip Ledger — Portfolio Source

> 项目素材，供后续制作 Portfolio 使用。依据当前核心页面与实现更新（2026-10-06）；下列代码路径相对项目根目录。不是最终作品集文案，本次未运行项目或核实线上版本。

## 1. Project Overview

- **Project name：** PokerChip Ledger
- **One-line description：** 将实体牌局计分、多人同步记分和线上德州扑克对战放在同一套牌桌界面的 Web App。
- **Problem / Goal：** 帮助玩家记录行动、筹码与底池，并把单手输赢汇总为可查看的整场结算；线上模式同时完成匹配、发牌与规则判定。
- **My role：** `Unknown / needs manual input`。代码包含界面、规则算法、后端及部署配置，无法确认个人负责范围。
- **Type：** Web App / Game Companion
- **Main stack：** Next.js / React、Zustand、Tailwind CSS / Framer Motion、Express / Socket.IO、PostgreSQL / Prisma。
- **Status：** Deployed project（仓库记录了生产部署；最新代码是否已上线：`Unknown / needs manual input`）。
- **Links：** [Live site](https://poker.yanyihan.top/) · [GitHub](https://github.com/YanYihann/poker-chip-tracker)

## 2. The Idea

**为什么会有这个项目？** 从现有功能与产品说明看，项目面对的是牌局中行动顺序、下注、分池和最终筹码结果的记录问题。个人最初的动机、真实使用场景与用户研究：`Unknown / needs manual input`。

**核心 idea 是什么？** 用可视化牌桌承载整场流程。实体牌模式保留真实扑克牌，由用户记录行动和选择赢家；线上模式由服务端发牌、控制回合和自动结算。玩家可以单设备使用，也可以通过房间码或随机匹配进入多人牌桌。

**最重要的一点是什么？** 同一套牌桌把“谁行动、筹码去哪、这一手如何判定、整场如何结算”连接起来；完整体验延伸到牌局结束后的筹码转移方案和逐手记录。

## 3. How It Works

以下选择当前最完整的**线上随机匹配**流程；私有房间改为房主开局，本地计分改为人工确认赢家。

### 01 — Choose a table

登录后选择 2–8 人及新手／高手／专家场；界面显示对应起始筹码和盲注。

### 02 — Take a seat and ready up

开始匹配后立即进入准备桌，其他相同人数、场次的玩家陆续加入。玩家选座并点击准备；满员且全员准备后自动开局。

### 03 — Play your turn

查看本人底牌，在自己的回合跟注、加注、过牌、弃牌或全下；公共牌随下注轮推进公开。

### 04 — Review and decide

系统自动结算，展示净变化、牌型与最佳五张。仍入座且有筹码的玩家全部选择下一手后才继续；线上参与者也可确认结束牌局。

### 05 — View the session report

结束后查看整场净盈亏、筹码转移方案与逐手明细，之后可从线上历史重新打开报告。

## 4. Key Features & Decisions

### Feature 01 — 实体牌计分与可恢复操作

**What it does：** 单设备免登录记录玩家行动、下注与底池，人工选赢家；支持撤销、重开结算和恢复进度。实体牌也能通过房间让每人分别操作。

**Why it matters：** 不要求替换真实扑克牌，记录失误可以纠正。单设备由操作者控制，多设备由服务器同步。

**How it works：** 本地自动保存状态，撤销恢复动作前的完整牌桌快照；同步计分使用房间状态，房主确认结算。软件不识别实体牌。

**Relevant files：** `src/app/local/page.tsx`、`src/features/table/useTableController.ts`、`src/features/table/snapshot.ts`。

### Feature 02 — 从随机匹配直接进入可选座的准备桌

**What it does：** 按人数与场次进入准备桌；可换空座，或通过座位选择框与未准备玩家换位，明确准备后再开局。

**Why it matters：** 等待对手时已经能看到正式牌桌的空间关系。随机匹配要求满员且全员准备；私有房间则入座自动准备，由房主开始，适配不同组局方式。

**How it works：** 服务端按人数、场次查找可用桌并预留座位；准备页复用牌桌组件，满足开局条件后自动跳到对战页面。

**Relevant files：** `src/app/online/match/page.tsx`、`src/app/rooms/[roomCode]/page.tsx`、`server/src/modules/matchmaking/matchmaking.service.ts`。

### Feature 03 — 自动判定、分池与共同决定下一手

**What it does：** 线上发牌、逐阶段亮公共牌、比较牌力，处理全下边池、平局和余数筹码；结算后玩家共同决定是否继续。

**Why it matters：** 结果同时呈现牌型、最佳五张和净变化，能够解释输赢。继续下一手需要仍有筹码的入座玩家同意，已同意者看到等待人数，也能选择结束。

**How it works：** 对局中仅向本人返回其底牌；确定性算法枚举五张组合比较牌型与 kicker，按投入贡献层分池。下一手同意名单记录在当前手牌上；没有 AI。

**Relevant files：** `server/src/modules/rooms/hand-evaluator.ts`、`server/src/modules/rooms/room.service.ts`、`src/features/table/adapters/useOnlineRoomTableModeAdapter.tsx`。

### Feature 04 — 从单手输赢到整场筹码转移

**What it does：** 结束整场后显示起始／最终筹码、净盈亏、赢牌手数、筹码转移方案，并能展开逐手明细；本地和线上历史分别查看。

**Why it matters：** 结果不仅停留在谁赢了这一手，还回答整场结束后谁向谁转移多少筹码。

**How it works：** 统一的结算模型汇总本地记录或服务端历史；按净亏损与净收益配对生成转移建议，只有筹码总额平衡时才计算。界面提供建议，不执行支付。

**Relevant files：** `src/features/settlement/session-summary.ts`、`src/components/settlement/session-settlement-content.tsx`、`src/components/settlement/session-history-page.tsx`。

### Feature 05 — 手机整屏牌桌与专用下注键盘

**What it does：** 深绿桌面、纸质牌面与筹码动效延续到手机；竖屏将操作栏放在底部，横屏放在右侧，下注金额用应用内数字键盘输入。

**Why it matters：** 当前行动、底池和可用操作集中在同一视口；专用键盘避免系统软键盘占去大半牌桌。手机单手结果另用弹窗展开。

**How it works：** 跟踪可视视口、适配横竖屏，并在用户手势后尝试全屏；CSS 保留安全区域，数字输入通过原生 dialog 展示。动效支持减少动态效果偏好。

**Relevant files：** `src/features/table/presentation/use-mobile-table-viewport.ts`、`src/components/actions/mobile-wager-input.tsx`、`src/app/globals.css`。

## 5. Technical Notes & Limitations

### Worth mentioning

- **共享牌桌模型：** 本地与房间适配器接到同一展示层，复用座位、底池与动作组件；状态来源分别是浏览器和服务端。
- **同步与一致性：** 房间关键写入使用数据库行锁，旧读取响应不能覆盖写操作后的状态。支持 Socket.IO 或可见页面轮询；当前轮询按进行中／准备与结算／结束状态调整频率，进行中目标间隔为 250ms，并非实测延迟保证。
- **匹配座位租约：** 匹配预留座位有 30 秒租约，准备桌定期续期；过期座位在后续匹配处理时回收，减少失联玩家占座。
- **程序生成声音：** `src/lib/audio.ts` 本地合成点击音与大厅／牌桌两种音乐；音效、音乐可分别开关，不依赖外部录音下载。适合在短录屏中体现。

### Current limitations

- 单设备本地历史与恢复数据保存在当前浏览器，不能跨设备读取；页面重载也不保留内存中的撤销栈。旧快照可能缺少完整逐手记录，报告会提示统计范围。
- 联机需要可用 API、数据库和持续联网；准备阶段若租约过期会回到匹配入口，轮询同步也受网络耗时影响。
- 手机全屏受浏览器支持与权限限制，可能被拒绝；实现保留浏览器栏可见时的视口布局，不能宣称所有手机都能原生全屏。
- 线上牌数据不完整时，服务端存在按有资格玩家平分边池的回退；不能宣称异常状态下也始终按牌力结算。

## 6. Screenshot List

建议选择以下 **7 张**。桌面约 1280–1440px 宽，手机用真实 375–390px 竖屏并补充横屏录屏；统一语言，等待字体、数据和动效稳定。以下是人工准备指南，本次不生成截图。

**共用 demo：** 用 Alex、Maya、Chen、Nora 等正常昵称。线上截图准备三个独立账号，以不同浏览器 profile 或设备登录；普通标签页共享登录 Cookie。优先用专用 demo 环境，在同一新手场、三人桌匹配，保持准备页前台以续期。线上牌面随机，没有指定发牌入口；不要求特定牌型。

### Screenshot 01 — 游戏大厅

**Page / Route：** `/online`，不带 `room` 参数。

**What to show：** TEXAS HOLD’EM 标题、扇形扑克牌，以及随机匹配、创建房间、加入房间、本地记分四个入口。

**How to prepare：**

1. 打开大厅并选择统一语言，无需登录。
2. 等待扑克牌入场结束，桌面截完整菜单。

**Recommended content：** 无需牌局数据，四个入口都保留。

**Why this screenshot matters：** 一眼说明项目类型、使用方式与视觉语言。

### Screenshot 02 — 本地计分中的行动状态

**Page / Route：** `/local`，不带 `room` 参数；手机优先。

**What to show：** 四名玩家、庄／盲注、非零底池、当前行动者，以及底部跟注、加注、撤销等操作。

**How to prepare：**

1. 在 demo 浏览器设置四人，填写 Alex、Maya、Chen、Nora，每人 10,000；自动排座后开始。
2. 记录一次跟注，停在下一位玩家行动时。
3. 用手机竖屏截牌桌与操作区同屏的状态；如有恢复提示，仅处理 demo 快照。

**Recommended content：** 四人实体牌局；屏幕公共牌是流程占位，不作为实体牌识别结果展示。

**Why this screenshot matters：** 展示免登录计分及集中、可纠错的操作体验。

**Better as video / GIF：** 跟注 → 筹码飞入底池 → 撤销 → 筹码和行动者恢复。

### Screenshot 03 — 匹配后的选座与准备

**Page / Route：** `/rooms/<实际房间码>`，从 `/online/match` 进入。

**What to show：** 三人准备桌、已准备／未准备标记、人数与准备进度、场次和盲注、我的位置选择框、准备按钮。

**How to prepare：**

1. 三个账号分别在匹配页选择三人、新手场（10,000 筹码，100/200 盲注），开始匹配。
2. 等三人进入同桌，通过“我的位置”与一位未准备玩家换位。
3. 只让一人准备，切到未准备账号截图，暂不让全员准备；保持页面可见。

**Recommended content：** Alex、Maya、Chen；三人入座、仅一人准备，能同时看到两种准备状态。

**Why this screenshot matters：** 展示匹配后玩家仍能控制座位，并明确确认开局。

**Better as video / GIF：** 选人数与场次 → 进入准备桌 → 换座 → 最后一人准备 → 自动进入对战。

### Screenshot 04 — 线上对战与私有底牌

**Page / Route：** `/online?room=<实际房间码>`；桌面优先。

**What to show：** 三张公共牌、本人两张底牌、其他玩家未公开的底牌状态、筹码与下注额、右侧操作栏。

**How to prepare：**

1. 接上一张，让全员准备，自动开局。
2. 各账号按顺序跟注，最后大盲过牌，进入 flop。
3. 切到当前行动账号，等同步完成，截牌桌、本人底牌与可用操作。

**Recommended content：** 三人、非零底池、尚未结算；使用真实随机牌面。

**Why this screenshot matters：** 展示发牌、逐阶段公开与本人回合控制的核心对战体验。

**Better as video / GIF：** 翻牌前最后一次过牌 → 公共牌翻开 → 下一位玩家获得操作。

### Screenshot 05 — 手机下注数字键盘

**Page / Route：** 同一线上牌桌，当前账号正在行动；手机竖屏。

**What to show：** 应用内数字键盘、下注总额、取消／确定按钮，以及背景中仍可辨认的牌桌。

**How to prepare：**

1. 在当前行动账号的手机打开牌桌，等视口布局稳定。
2. 点下注金额显示，打开数字键盘，输入 600，暂不确认，截图。
3. 如继续 demo，确认金额后再点击相应下注按钮；截图时不需要真的提交动作。

**Recommended content：** 新手场的 flop，使用合理下注额 600；金额含义是“本轮下注总额”。

**Why this screenshot matters：** 展示针对手机牌桌空间设计的输入细节。

**Better as video / GIF：** 打开键盘 → 改金额 → 确认 → 下注；可补充旋转横屏后的右侧操作布局。

### Screenshot 06 — 自动结算与最佳五张

**Page / Route：** 同一 `/online?room=<实际房间码>` 的已结算状态；桌面优先。

**What to show：** 完整公共牌、结算后的玩家筹码／净变化、牌型名称与最佳五张，以及继续／结束操作。

**How to prepare：**

1. 如已下注，让其他玩家跟注；剩余下注轮依次过牌，至少两人不弃牌进入摊牌。
2. 等自动结算完成，截牌桌与至少两名玩家的结果卡。
3. 截图前不要点击下一手；点击后当前账号会切到等待其他玩家的页面。

**Recommended content：** 真实随机结算即可，不指定平局或罕见牌型；手机补图需点击“本手结果”打开弹窗。

**Why this screenshot matters：** 把牌面、判定依据与筹码变化放在同一张图中。

**Better as video / GIF：** 一人选择下一手 → 显示等待人数 → 其余有筹码玩家同意 → 自动发下一手。

### Screenshot 07 — 整场结算与逐手明细

**Page / Route：** `/history/<真实 sessionId>`；从 `/history/online` 点击已结束牌局进入。

**What to show：** 筹码转移箭头与金额、三人最终筹码／净盈亏／赢牌手数，以及展开的一手明细。

**How to prepare：**

1. 第一手结束后，所有仍入座且有筹码的玩家选择下一手，再完成一手。
2. 一位参与者点击“结束牌局”，在弹窗确认；等待最终报告加载。
3. 从线上历史打开该记录的详情链接，展开一手明细，用桌面视口截图。
4. 保留转移方案和玩家结果为主画面；长内容可另裁切明细，不把空历史页作为展示图。

**Recommended content：** 至少两手、有非零净盈亏的三人牌局；使用真实记录，不改牌面或数据制造输赢。sessionId 来自历史链接，不能用房间码替代。本地对应入口为 `/history/local`，设备记录点击后在弹窗查看同类报告。

**Why this screenshot matters：** 展示对战结束后仍可追溯、可用于实际筹码结算的完整结果。

优先省略登录、设置、普通创建表单和空页面。截图展示界面，短录屏展示同步、动效与声音；不据此推导用户反馈、使用人数或成果数据。
