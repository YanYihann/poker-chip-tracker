# PokerChip Ledger

> 用途：后续作品集制作的内部项目资料，不是 Portfolio Case Study。分析日期：2026-10-03；源码基线：`b5207a1`。本文依据当前源码、配置、测试和项目文档整理，不代表重新完成线上验收。
>
> 当前工作区包含多个目录，实际应用与 Git 仓库位于 `poker-chip-tracker/`，本文整理至该仓库的 `docs/portfolio/`。下文代码路径仍相对仓库根目录。`awesome-design-md/` 是独立的设计参考资料集合；工具技能、构建产物和历史截图不属于应用运行代码。

## 1. Project Overview

| 项目 | 可确认信息 |
| --- | --- |
| 名称 | PokerChip Ledger；npm 包名 `poker-chip-tracker` |
| 类型 | 德州扑克 Home Game 的 Web 计分、多人房间、线上发牌与结算工具 |
| 核心用途 | 管理座位、筹码、盲注、行动顺序、底池、单手结算和已完成房间记录 |
| 解决的问题 | 单设备记录实体牌局，以及多设备共享同一牌局状态和结算结果 |
| 主要用户 | 一起玩德州扑克的朋友、线下牌局组织者、线上房间房主和成员 |
| 当前状态 | 已有完整前后端、数据库迁移、实际页面和测试；包版本 `0.1.0`，仍存在第 12 节所述实现限制 |
| Live URL | [poker.yanyihan.top](https://poker.yanyihan.top/)；README 和部署记录明确指向此地址，本次未联网核实可用性 |
| Repository URL | [YanYihann/poker-chip-tracker](https://github.com/YanYihann/poker-chip-tracker)；README 与本地 Git `origin` 一致 |
| 许可 | MIT，见 `LICENSE` |

本次实际运行 `npm test`：**18 项测试通过，0 项失败**。没有运行数据库集成测试、浏览器流程、lint、类型检查或生产构建；已有文档中的过去验收记录不能当成本次结果。

### 必须区分的三种使用方式

| 方式 | 入口 | 登录 | 牌与结算 | 数据权威来源 |
| --- | --- | --- | --- | --- |
| 单设备本地计分 | `/local`，无 `room` 参数 | 不需要 | 实体牌；操作员逐池选择赢家 | Zustand + 浏览器 localStorage |
| 多设备同步计分 | 创建房间时选 Synced scoring；服务端 `gameMode=local` | 需要 | 实体牌；房主提交赢家，服务端分配筹码 | Express + PostgreSQL |
| 线上对战 | 创建房间时选 Online play；`/online?room=<code>` | 需要 | 服务端洗牌、发牌、按阶段公开公共牌并自动判定赢家 | Express + PostgreSQL |

同步计分的手动结算适配器存在于 `/local?room=<code>`，但当前等待房间统一跳转 `/online?room=<code>`；不能把这条入口的端到端完整性写成已确认，详见第 12 节。

README 明确项目不处理支付或真实货币交易。页面中的 `$`、P/L 和 Total Assets 是计分显示，不是钱包或充值提现能力。

## 2. Background & Problem

- **可确认背景：** `PRODUCT.md` 说明同时服务实体牌桌和共享线上房间，目标是让玩家清楚进入牌桌并完成一手牌；`docs/product-spec.md` 的早期定位侧重线下筹码记录。
- **根据功能可归纳的问题：** 实体牌局需要持续记录每人的筹码和下注；多人全下时需要区分各池资格；多设备参与时需要共同的行动顺序和结算结果。
- **实际解决方式：** 本地模式减少登录和后端依赖；房间模式以四位数字码组织成员，把规则校验、牌局推进和筹码结算交给服务端；共享牌桌界面展示当前状态。
- **核心 idea：** 一套牌桌呈现组件，分别连接本地计分控制器和服务端房间适配器。
- **无法确认：** 项目最初产生的个人经历、正式用户访谈、上线时间、开发时长、作者具体职责、用户数量和量化收益，**无法从当前项目文件中确认。**

## 3. Target Users

- **单设备操作员／线下组织者：** 为 2–10 位玩家设置姓名、筹码和实体座位，代为记录各人的操作并人工确认赢家。
- **房主：** 设置人数上限、统一起始筹码和盲注，分享房间码、开始牌局、决定下一手或结束归档。
- **房间成员：** 登录、输入房间码、换到空座，在自己的回合操作并查看结果。
- 早期规格还提到 Small club admins，但当前未发现俱乐部管理、后台管理或组织级权限页面。

## 4. Core User Flow

### 单设备本地计分（5 步）

1. **进入大厅 → Local game：** 用户打开 `/local`；系统检查是否有可恢复快照。
2. **设置牌桌：** 用户设置人数、姓名和筹码，点选座位或 Auto-seat；系统按选择顺序分配玩家和初始庄位。
3. **开局和记录动作：** 用户点击 Take seats & play，依次代玩家弃牌、跟注、过牌、加注或全下；系统扣筹码、累加底池并推进回合。
4. **人工结算：** 系统进入待结算；用户为当前池选择一名或多名赢家，系统逐池分配筹码并记录本地结算摘要。
5. **继续或恢复：** 用户开始下一手，或离开后再次打开页面选择 Resume；系统轮换庄位、自动保存并恢复牌桌。当前没有连接到账号历史的本地整局归档流程。

### 服务端房间（6 步）

1. **选择创建／加入：** 未登录用户转到 `/auth?next=…`，登录或注册后返回原目标页面。
2. **房主配置：** 房主选择 Online play 或 Synced scoring，并设置统一筹码、盲注和容量；系统创建房间和四位数字码。
3. **成员入座：** 其他账号通过房间码加入；系统自动分配空座并准备，用户可在等待牌桌上换到空座。
4. **房主开始：** 至少两人且均有座位时房主点击 Start game；系统记录盲注、行动玩家，线上模式另行发牌，客户端收到状态后进入牌桌。
5. **依次操作及结算：** 成员仅能在自己回合提交动作；系统校验并推进阶段，线上模式自动结算，同步计分由房主人工选赢家。同步计分需留意上述入口限制。
6. **继续／归档：** 已结算后房主选择下一手或 End Session & Archive；系统轮换庄位或写入整局与个人统计，用户在 `/history` 和 `/profile` 查看。

## 5. Core Features

### 5.1 本地牌桌设置、计分与恢复

**作用：** 让实体牌局用一个设备记录，无需账号。

**用户操作：** 选择 2–10 人、编辑玩家姓名与起始筹码、选择座位开局；重新打开后选择恢复或丢弃快照。

**系统行为：** 本地适配器连接多个 Zustand store；状态变化以 180ms 防抖保存，`pagehide` 时补充写入；快照包含会话、手牌阶段、下注和结算状态。

**相关代码：** `src/app/local/page.tsx`、`src/features/table/adapters/useLocalTableModeAdapter.tsx`、`src/features/table/useTableController.ts`、`src/features/table/snapshot.ts`、`src/features/persistence/storage.ts`。

### 5.2 房间配置、加入与选座

**作用：** 建立多人共享牌局，并在开局前统一筹码和盲注。

**用户操作：** 房主创建房间，成员输入四位码和可选显示名加入；点空座换位；房主统一开始。

**系统行为：** 默认 4 人、每人 10,000、盲注 100/200；验证正整数及 `小盲 ≤ 大盲 ≤ 起始筹码`。加入自动入座并准备；开局前重新统一旧房间的筹码。选座、加入和开始等操作使用同一房间行锁。

**相关代码：** `src/app/rooms/`、`src/features/rooms/api.ts`、`server/src/modules/rooms/room.schemas.ts`、`server/src/modules/rooms/room.service.ts`。

### 5.3 回合制下注与牌局推进

**作用：** 跟踪行动顺序、合法动作、当前下注和底池。

**用户操作：** 弃牌、过牌、跟注、下注、加注或全下；下注／加注可输入本轮总额，亦可用 ±50／±100 调整。

**系统行为：** 按筹码、需跟注额、最小加注和之前是否已行动计算合法按钮；处理单挑盲注、弃牌和全下玩家跳过、加注后的重新响应，以及 preflop → flop → turn → river → showdown。联机操作再次由服务端检查成员、回合和金额。

**相关代码：** `server/src/modules/rooms/betting-round.ts`、`server/src/modules/rooms/room.service.ts`、`src/features/table/rules.ts`、`src/features/table/useTableController.ts`、`src/components/actions/bottom-action-panel.tsx`。

### 5.4 服务端发牌、私有底牌与自动牌力结算

**作用：** 在线上模式中由统一服务负责牌数据和赢家计算。

**用户操作：** 选择 Online play、开局后查看自己的底牌，完成行动后查看结算结果。

**系统行为：** 创建 52 张牌，用 `crypto.randomInt` 的 Fisher–Yates 洗牌；每人两张底牌并预分配五张公共牌。对局中只返回请求者底牌，公共牌按 0/3/4/5 张公开；结算后展示结果、底牌、牌型和最佳五张。枚举五张组合比较牌型及 kicker，无 AI 参与。

**相关代码：** `server/src/modules/rooms/deck.ts`、`server/src/modules/rooms/hand-evaluator.ts`、`server/src/modules/rooms/room.service.ts`、`src/components/table/online-my-hole-cards.tsx`、`src/components/table/online-hand-settlement-view.tsx`。

### 5.5 分池结算与本地纠错

**作用：** 根据投入额和资格处理主池、边池、平分与多余筹码，支持本地误操作修正。

**用户操作：** 本地操作者逐池选赢家或平分，使用撤销／重开结算；同步计分房主提交赢家；线上对战自动评估每池赢家。

**系统行为：** 以累计投入的不同层级拆池，弃牌者不能竞争池，单人贡献层退回本人；平分余数按庄位之后顺时针分配。本地操作前保存跨 store 快照，撤销恢复筹码、阶段和顺序。服务端同步计分一次提交的赢家集合应用于各贡献层，与本地逐池选人的交互不同。

**相关代码：** `server/src/modules/rooms/betting-round.ts`、`server/src/modules/rooms/room.service.ts` 的 `settleCurrentHand`、`src/features/table/useTableController.ts`、`src/store/useHandStore.ts`、`src/components/settlement/settlement-modal-placeholder.tsx`。

### 5.6 多设备状态同步

**作用：** 让参与者观察同一房间进度，并收到当前用户可执行的动作。

**用户操作：** 加入房间、保持页面打开、提交自己的动作。

**系统行为：** Vercel 模式通过环境变量选 HTTP 轮询，可见页面每次刷新完成后约 1.5 秒再刷新，失败延后到 5 秒；独立服务支持 Socket.IO 个性化全量状态和公开 patch。轮询通过 mutation epoch 丢弃横跨写操作的旧响应；patch 后再次拉取个人合法动作。

**相关代码：** `src/features/rooms/realtime.ts`、`src/features/rooms/api.ts`、`src/features/table/adapters/useOnlineRoomTableModeAdapter.tsx`、`server/src/realtime/`。

### 5.7 账号、资料与房间历史

**作用：** 将服务端牌局结果关联到参与者，并查看累计和逐手结果。

**用户操作：** 邮箱注册／登录，编辑昵称、上传头像；房主结束归档后查看 Profile、History 和详情。

**系统行为：** bcrypt 保存密码哈希，随机会话令牌通过 HttpOnly Cookie 携带，数据库保存 SHA-256 哈希及有效期；头像在浏览器缩小压缩为图片 data URL 后存入 Profile。整局归档更新 GameSession、PlayerSessionStat 与个人统计，详情仅向参与者开放。

**相关代码：** `src/app/auth/page.tsx`、`src/app/profile/page.tsx`、`src/app/history/`、`server/src/modules/auth/`、`server/src/modules/profile/`、`server/prisma/schema.prisma`。

## 6. Pages & Interfaces

| 页面／View | Route | 用途与主要功能 | 主要代码 |
| --- | --- | --- | --- |
| 首页跳转 | `/`、`/?room=<code>` | 分别转 `/online` 或带 room 参数的线上牌桌 | `src/app/page.tsx` |
| 游戏大厅 | `/online`，无 room 参数 | 创建、加入、本地模式三项入口；资料、历史和语言切换 | `src/app/online/page.tsx`、`src/components/layout/entry-art.tsx` |
| 登录／注册 | `/auth?next=<path>` | 两种表单、密码可见性、登录后返回目标路由 | `src/app/auth/page.tsx` |
| 本地牌桌 | `/local`，可用 `?players=4` | 人数、姓名、筹码、选座、回合操作、手动结算及快照恢复 | `src/app/local/page.tsx`、本地适配器 |
| 同步计分牌桌 | `/local?room=<code>` | 使用服务端状态，提供房主人工结算；须先加入且房间已开始 | `src/app/local/page.tsx`、房间适配器的 `variant: local` |
| 创建房间 | `/rooms/create` | 选择模式、容量、统一筹码和盲注；需要登录 | `src/app/rooms/create/page.tsx` |
| 加入房间 | `/rooms/join` | 四位码与可选显示名；需要登录 | `src/app/rooms/join/page.tsx` |
| 等待牌桌 | `/rooms/[roomCode]` | 中央房间码与复制、玩家座位、换座、设置摘要、房主开始 | `src/app/rooms/[roomCode]/page.tsx` |
| 线上牌桌 | `/online?room=<code>` | 公共牌、本人底牌、轮到本人时的下注控件；等待中的房间转等待页 | `src/app/online/page.tsx`、房间适配器 |
| 自动结算结果 | 同一线上牌桌路由 | 已结算状态替换主内容，展示结果、最佳五张及房主下一手／归档动作 | `src/components/table/online-hand-settlement-view.tsx` |
| 手动结算弹窗 | 无独立 route | 当前池候选赢家、Win／Split、关闭；本地自动打开或同步房主打开 | `src/components/settlement/settlement-modal-placeholder.tsx` |
| 个人资料 | `/profile` | 资料、头像、语言、累计统计、最近历史、退出登录；需要登录 | `src/app/profile/page.tsx` |
| 历史列表 | `/history` | 最近 20 个服务端已归档会话，展示本人起止筹码、手数和盈亏 | `src/app/history/page.tsx` |
| 历史详情 | `/history/[sessionId]` | 整局概览、本人结果、整桌结果和逐手分配；需要参与者账号 | `src/app/history/[sessionId]/page.tsx` |

### 当前设计语言

- `DESIGN.md` 和当前 CSS 明确采用 Balatro 启发的游戏菜单：深绿背景 `#153e35`、炭灰面板、暖纸牌 `#fff5db`、金色主操作、红色创建／弃牌与蓝色加入／跟注。
- Bungee 用于拉丁标题和数字，Manrope 用于正文，中文使用系统字体回退；大厅有用 HTML/CSS 扑克牌构成的五张扇形牌。
- 牌桌是圆角矩形，座位沿周边排列，中央放底池和公共牌，行动者带金色边框及文字标记。
- 桌面 ≥1024px：牌桌配右侧 320px 操作栏；较小屏幕：操作区在牌桌之后的文档流中。Profile 在桌面采用两列独立内容，手机纵向排列；等待页的设置在 <1024px 移到牌桌下方。
- 首访默认英文，明确选择的中英文保存在当前浏览器。已有部分标签、数字格式和辅助文本未完全统一，见第 12 节。
- 有聚焦边框、数值键盘提示、弹窗焦点约束、Escape 关闭与 reduced-motion 分支；不能仅据此宣称达到完整 WCAG AA 验收。

## 7. Tech Stack

| 分层 | 实际使用的技术 | 使用位置／理由 |
| --- | --- | --- |
| Frontend | Next.js 15、React 19、TypeScript | App Router 页面、客户端交互、领域和适配器类型 |
| 状态 | Zustand | 本地会话、手牌、下注、结算、归档和视觉事件；联机适配器主要使用 React state |
| UI | Tailwind CSS 3、自定义 CSS 变量、Framer Motion、Phosphor Icons | 主题、响应式布局、牌和筹码动效、导航图标；未发现独立 UI 组件库核心依赖 |
| Backend | Node.js ≥20、Express 5、TypeScript、Zod | REST API、房间领域逻辑、输入／配置验证 |
| 同步 | HTTP fetch 轮询、Socket.IO 4 | Vercel 使用轮询，独立长驻服务器使用 Socket.IO |
| Database | PostgreSQL、Prisma 6 | 账号、房间、手牌动作、结果及整局统计；部署文档采用 Neon |
| Authentication | bcryptjs、Node crypto、Cookie 会话 | 自建邮箱密码认证；未使用第三方 Auth 服务或 JWT 登录流程 |
| Testing | Node 内置 test runner、tsx、assert | 现有规则／布局／轮询／配置测试，另有需本地数据库的集成测试 |
| Deployment | Vercel + Neon 配置；独立服务／Railway 指南 | Next Pages API 封装 Express；独立 HTTP server 挂 Socket.IO |

未发现 AI SDK、对象存储上传服务、支付接入或独立可视化图表库作为运行功能。

## 8. Architecture

```text
用户 → Next.js 页面 → 共享 TableModeScreen / PokerTable / ActionPanel
                          │
                          ├─ 单设备本地适配器
                          │   → 本地控制器 + 共享下注规则 → Zustand
                          │   → localStorage（活动快照 / 结算摘要）
                          │
                          └─ 服务端房间适配器
                              → HTTP API（提交动作 / 拉取个人状态）
                              → 轮询 或 Socket.IO（接收房间更新）
                              → Express 领域服务 → Prisma → PostgreSQL
```

- **共享呈现层：** `TableModeAdapter` 定义玩家、底池、阶段、动作、金额输入、结算和恢复信息；视图消费统一契约，传输代码位于 features 层。
- **本地逻辑：** `useTableController` 负责牌局状态与筹码变更；共享下注工具直接从 `server/src/modules/rooms/betting-round.ts` 引入。localStorage 有活动快照和最多 200 条结算摘要，不等同于云端整局归档。
- **服务端逻辑：** routers 验证输入和认证，`room.service.ts` 负责房间生命周期、行动、结算和归档；客户端渲染服务端投影，不能自行确认联机余额。
- **主要数据关系：** User ↔ Profile / RefreshToken；GameRoom → RoomPlayer / Hand；Hand → HandAction / HandResult；房间结束后 → GameSession → PlayerSessionStat。
- **数值保存：** 数据库筹码及统计用 BigInt；房间响应转为 JS number，个人历史接口多用十进制字符串。
- **两种部署：** Vercel 用 `src/pages/api/[...path].js` 调用编译后的 Express，`/api/health` 映射 `/health`，需 `NEXT_PUBLIC_API_TRANSPORT=polling`；独立 `server/src/index.ts` 启动 HTTP 和 Socket.IO。
- **外部服务：** Neon 提供 PostgreSQL，Vercel 提供托管；Railway 是另一套部署指南。本次未查询实际云端控制台或数据库配置。

## 9. AI Implementation

> 本项目未发现 AI 功能。

运行源码未发现模型 API、Prompt、structured output、streaming、RAG／embeddings、多模态、tool calling 或模型上下文管理。牌力判断是确定性的扑克牌算法；仓库旁的 AI 工具技能及设计资料不构成应用 AI 功能。

## 10. Important Implementation Details

### 10.1 多种数据来源共用同一牌桌契约

**是什么：** 本地和服务端适配器把不同状态模型转成 `TableModeAdapter`。

**为什么需要：** 单设备实体计分与账号房间共享座位和动作界面，但存储与权限不同。

**如何实现：** 页面选择适配器，`TableModeScreen` 统一组合牌桌、操作栏、提示和弹窗；服务端结果可通过 `mainContent` 替换主区域。

**相关代码：** `src/features/table/mode/types.ts`、`src/features/table/adapters/`、`src/features/table/presentation/table-mode-screen.tsx`。

### 10.2 贡献层底池与短全下后的加注权

**是什么：** 根据投入层级拆分主池／边池，并记录各人行动时面对的下注额。

**为什么需要：** 不同筹码的全下玩家不能赢超出其参与范围的池；不足额加注不一定重开先前玩家的加注权。

**如何实现：** `buildContributionPots`／服务端分池函数按贡献额层级分池；`replayBettingRound`、`actedAtBet` 和 `legalBettingActions` 计算合法动作；`splitPotClockwise` 确定余数归属。

**相关代码：** `server/src/modules/rooms/betting-round.ts`、`server/src/modules/rooms/room.service.ts`、`src/features/table/useTableController.ts`、`tests/poker-rules.test.ts`。

### 10.3 个性化底牌与公开状态分离

**是什么：** 全量房间状态按账号生成，公开 patch 不带底牌。

**为什么需要：** 多人同步过程中不能把某个玩家的私有牌随公共广播发给其他人。

**如何实现：** `buildRoomState(room, userId)` 取本人底牌和合法动作；Socket 全量广播对每个 userId 生成投影；公共牌按 street 截取，patch 使用独立结构。正常结算后结果会公开玩家底牌，隐私边界随阶段变化。

**相关代码：** `server/src/modules/rooms/room.service.ts`、`server/src/realtime/room-broadcast.ts`、`server/src/realtime/room-patch.ts`。

### 10.4 房间写入串行化与旧轮询响应过滤

**是什么：** 数据库写入一致性和客户端异步响应次序保护。

**为什么需要：** 同时争抢最后一个空座或开始游戏可能冲突；旧读请求也可能覆盖刚提交的动作结果。

**如何实现：** 加入、换座、盲注、买入及首次开始和下注动作通过事务中的 `SELECT … FOR UPDATE` 锁房间；轮询捕获 mutation epoch，写入前后 epoch 改变时丢弃旧结果。不能据此推断全部生命周期操作都有同等防重保障。

**相关代码：** `server/src/modules/rooms/room.service.ts` 的 `lockRoom`／`applyPlayerActionByRoomCode`、`src/features/rooms/api.ts`、`src/features/rooms/realtime.ts`、`tests/room-sync.test.ts`。

### 10.5 跨 store 快照、撤销与恢复边界

**是什么：** 一次快照描述会话、行动顺序、下注和结算四个状态切片。

**为什么需要：** 撤销需要整体恢复，避免只改筹码而未恢复行动顺序或阶段。

**如何实现：** 可撤销动作先入内存 `historyStack`；恢复函数写回各 store，并清理视觉事件。持久化版本为 1，保存当前切片和时间，不保存内存撤销栈。

**相关代码：** `src/features/table/snapshot.ts`、`src/features/table/useTableController.ts`、`src/store/useHandStore.ts`、`src/features/persistence/storage.ts`。

### 10.6 固定座位、响应式布局及事件动效

**是什么：** `seatIndex` 决定位置，CSS 处理密集牌桌，Framer Motion 处理状态变化的视觉反馈。

**为什么需要：** 选座后进入对局不应因人数或列表顺序变化而移动玩家；手机也要保留下注、牌和状态信息。

**如何实现：** 沿椭圆轨迹计算座位坐标，本地固定十个可选位置、自动均匀分布；ResizeObserver 将坐标转换成筹码飞行动画起止点。下注／派彩事件由本地控制器发出；公共牌新公开时翻转，底池变化弹动，CSS 和部分 motion 组件适配 reduced motion。当前联机适配器未发现发出筹码飞行事件的代码。

**相关代码：** `src/lib/table-layout.ts`、`src/components/table/poker-table.tsx`、`src/components/table/table-motion-layer.tsx`、`src/components/pot/community-board.tsx`、`src/app/globals.css`、`tests/table-layout.test.ts`。

## 11. Technical Challenges

以下为源码复杂度判断，不能认定作者开发时实际遇到过这些问题。**从当前实现来看，这些是项目中复杂度较高的模块。**

| 问题 | 当前解决方式 | 相关代码 |
| --- | --- | --- |
| 多人下注的阶段、响应顺序和加注权必须一致 | 共享规则函数，本地 pending action order；服务端重放本阶段日志，校验本人回合后推进 | `betting-round.ts`、`room.service.ts`、`useTableController.ts`、规则测试 |
| 分池、平局、返还与手牌结果计算 | 贡献层资格、牌型类别与 kicker 比较、顺时针奇数筹码规则；本地逐池人工选人 | `room.service.ts` 的 `settleCurrentHand`、`hand-evaluator.ts`、`betting-round.ts` |
| 并发开局／抢座与异步旧状态覆盖 | PostgreSQL 行锁、唯一约束、客户端 mutation epoch；已有规则与房间集成测试源码 | `room.service.ts`、`schema.prisma`、`realtime.ts`、`tests/room-lifecycle.integration.ts` |
| 本地继续使用与线上权限隔离共存 | 本地快照和服务端数据分开，适配器转换共同视图模型，服务端生成每人可见状态 | `snapshot.ts`、`mode/types.ts`、两种适配器、`room-broadcast.ts` |
| 2–10 个座位在窄屏保留信息 | 固定座位坐标、密集模式隐藏头像、缩小标签、牌桌增加高度、操作栏移动到下方 | `table-layout.ts`、`player-seat.tsx`、`globals.css` |

这里未给出性能提升百分比或容量保证。服务端虽有 p50／p95 采样日志、20ms 广播合并和追踪字段，但本次没有测量结果，客户端 `action-trace.ts` 也未发现当前页面调用。

## 12. Current Limitations

1. **同步计分入口与结算视图不一致（源码推断，未做浏览器复现）。** 等待页对所有模式都跳 `/online?room=…`；该页面使用默认 `variant=online`，手动结算被隐藏，但后端对 `gameMode=local` 不自动结算。已开始的同步计分房间可通过 `/local?room=…` 连接人工结算适配器；不能宣称通常入口已形成无障碍闭环。相关：等待页、online/local 页面、房间适配器。
2. **本地归档未接主历史页。** 本地每次分池结算写一条摘要，最多 200 条；`HistoryPagePlaceholder` 存在但没有被当前路由引入。`/history` 只读服务器最近 20 个已归档会话，没有分页，也不能展示匿名本地记录。相关：本地控制器、`useArchiveStore.ts`、history 页面、`profile.service.ts`。
3. **持久化与离线支持有限。** 当前仅 localStorage；IndexedDB 只是类型枚举。快照只检查版本与 snapshot 是否存在，未做完整运行时结构校验；写入未捕获配额／禁用异常；内存撤销栈刷新后不恢复。未发现 service worker，页面加载后的本地逻辑不需要 API，但不能等同于完整离线安装／离线重新加载支持。
4. **部分早期规格没有实际交互。** 当前本地没有独立整局结束归档、补充买入／提现、任意手牌字段编辑界面；联机未提供撤销／重开结算。`runEditHand` 只是打开结算弹窗，schema 中 UNDO／EDIT 等枚举也不等于已提供对应 API。房间开始后新成员不能加入，未发现离开房间、踢人或房主转移入口。
5. **结算的异常与模式限制。** 在线牌数据不足时服务端会警告并把贡献层在有资格的玩家间平分，而非拒绝结算；同步计分使用同一个赢家集合结算各层，不能在 UI 单独给每个边池指定不同赢家。`settleHandByRoomCode` 和 `decideNextHandByRoomCode` 有事务但未见下注／首次开局所用房间行锁，不能保证并发重复结算／下一手请求的防重能力。
6. **房间同步和生命周期依赖部署。** Vercel 必须配置 polling；没有发现 WebSocket 连接失败后自动切轮询的逻辑。隐藏页面暂停轮询且错误只延后重试；无回合超时自动行动。四位房间码生成时查询所有历史房间、最多重试 10 次，未发现房间码回收；不应承诺无限房间规模。
7. **统计和数值含义有限。** Total Assets 是固定基数 10,000 加累计盈利减累计亏损，和房主选择的起始筹码不同；不是钱包余额。`handsPlayed` 按已结算手牌中该用户有动作日志的数量统计。数据库为 BigInt，但房间 API 和计算转 JS number，累计底池超安全整数范围的验证未完善。
8. **语言和可访问性尚非完整验收。** 本地动作主标签／工具按钮仍有中文硬编码，部分牌的默认 aria 文本是中文，金额在不同视图有 `$` 与纯数字差异。已有 reduced-motion 和弹窗焦点处理，但不是所有动效分支完全取消移动；本次没有检查完整对比度与读屏体验。10 人结算桌可增高至约 800px，短屏操作要滚动。
9. **验证和认证运维边界。** 有 18 项默认测试与单独数据库集成测试，但未发现自动浏览器测试／CI 配置或完整牌力评估测试。未发现邮箱验证、密码重置、身份提供商和登录／房间限流中间件；README 的建议不等于实现。当前 build 跳过 Next 的 ESLint 检查，需单独运行 lint。

以上记录用于准确描述当前版本，不包含本次修复任务。

## 13. Screenshot Plan

### 截图前准备

- **只安排人工截图：** 本次未启动截图自动化、未生成截图、未注入 demo 数据或修改业务代码。
- **Desktop 优先：** 大厅、等待牌桌、线上行动、自动结算、Profile、历史详情，建议 1280–1440px 宽。
- **Mobile 优先：** 本地选座／计分、手动结算、创建房间，建议 375–390px 宽。行动区在牌桌下面，需要滚动或长截图；十人桌不适合作为一屏主图。
- **不优先截图：** 首页重定向、普通登录页、单独加入表单、加载／网络错误／空历史、未接入路由的 placeholder 组件。登录可作为附图，不必占核心图名额。
- **建议 demo：** 本地用 Alex、Maya、Chen、Nora 等正常显示名；联机准备 2–4 个独立账号和浏览器 profile／不同设备。账号共用同一浏览器上下文会共享 Cookie，普通多个标签不能代表多个独立玩家。
- **默认参数：** 联机 4 人、每人 10,000、盲注 100/200；本地默认每人 2,000，可以在设置里改为 10,000。截图中的筹码和底池必须来自实际操作。
- **登录要求：** 大厅和单设备 `/local` 不需要；房间、Profile、History 都需要。历史截图必须先由房主结束并归档，完成一手还不够。
- **API Key：** 没有 AI／支付 Key 需求；联机需要运行中的 API 和已迁移 PostgreSQL。应用本地默认前端 3000、API 4001；Vercel 需 polling 环境变量。在线部署当前是否可用、本机服务是否已运行，本次未确认。
- **语言和素材：** 截图前统一使用顶部切换选定语言；先等字体、头像和数据加载稳定。现有 `docs/screenshots/`、`docs/assets/online-table-demo.gif` 可作历史参考，其与当前样式一致性未经本次核实，不直接当成新版截图。
- **随机牌面：** 当前没有固定种子／指定发牌的 UI；线上牌型和平局不可预先保证。通过真实对局获得适合展示的状态，不修改数据库伪造结果。

### Screenshot 01 — 游戏大厅与模式入口

**页面：** `/online`（`/` 会重定向到这里）。

**截图内容：** TEXAS HOLD’EM 标题、五张扇形牌、Create room／Join room／Local game 三项入口和顶部导航。

**操作步骤：**

1. 打开 `/online`，确保 URL 没有 `room` 参数。
2. 选择统一的截图语言。
3. 等待字体与入场动效结束。
4. 用桌面视口截取完整主菜单。

**推荐展示状态：** 不需要 demo 牌局或登录；可补一张手机纵向布局作为同图组。

**这张截图说明什么：** 产品入口、三种选择的关系与当前游戏界面风格。

**相关代码：** `src/app/online/page.tsx`、`src/components/layout/entry-art.tsx`、`src/app/globals.css`。

### Screenshot 02 — 本地玩家与实体座位设置

**页面：** `/local`，无 `room` 参数。

**截图内容：** 选中的座位、四位玩家姓名／起始筹码和 Take seats & play 控件。

**操作步骤：**

1. 在专用 demo 浏览器打开 `/local`；有旧快照时先恢复原数据，或仅丢弃明确不需保留的 demo 快照。
2. 设置四位玩家，先设置人数再填写姓名，避免人数变化重建玩家。
3. 填入示例姓名和每人 10,000 筹码。
4. 点击 Auto-seat，或按顺序选满四个座位，暂不开始。
5. 截取牌桌与设置区；手机若一屏容纳不下，用长截图。

**推荐展示状态：** 四个非空姓名、四个选中座位、开始按钮可用；免登录，API 不参与本地计分。

**这张截图说明什么：** 软件座位与实体牌桌对应，以及单设备使用门槛。

**相关代码：** `src/app/local/page.tsx`、`src/features/table/adapters/useLocalTableModeAdapter.tsx`、`src/lib/table-layout.ts`。

### Screenshot 03 — 本地分池手动结算

**页面：** `/local` 的结算弹窗。

**截图内容：** 当前待分配池、可赢该池的玩家、选中赢家与 Win／Split；背景保留牌桌。

**操作步骤：**

1. 用新的三人 demo，设置起始筹码 1,000／500／1,000，自动选座后开始。
2. 第一位行动玩家全下，之后两位按顺序跟注，等待进入结算。
3. 第一池应为 1,500，三人均有资格；选择两名赢家，截取可平分状态。
4. 点击 Split 后应剩 1,000 边池，候选只剩两位投入 1,000 的玩家。
5. 选择其中一名赢家，在确认 Win 前截取边池画面；两帧可作为同一图组。

**推荐展示状态：** 使用纯 demo，本地不发牌，赢家按示例实体牌结果人工选定；不要展示为系统自动识别实体牌。

**这张截图说明什么：** 不同全下投入产生的分池资格与人工确认流程。

**相关代码：** `src/components/settlement/settlement-modal-placeholder.tsx`、`src/features/table/useTableController.ts`、`server/src/modules/rooms/betting-round.ts`。

### Screenshot 04 — 创建房间与统一规则

**页面：** `/rooms/create`。

**截图内容：** Online play／Synced scoring 两项模式、人数、统一起始筹码、小盲／大盲和创建按钮。

**操作步骤：**

1. 用房主 demo 账号登录并打开创建页。
2. 选择 Online play。
3. 保留 4 人、10,000、100/200，或填写经过校验的正常参数。
4. 确保没有校验错误，截取填写完成、提交前的表单。

**推荐展示状态：** 桌面可完整截表单；手机适合展示模式纵向排列。需要登录与可用后端；无需提前生成牌局。

**这张截图说明什么：** 房主一次性配置公平一致的开局参数。

**相关代码：** `src/app/rooms/create/page.tsx`、`server/src/modules/rooms/room.schemas.ts`。

### Screenshot 05 — 可选座的等待牌桌

**页面：** `/rooms/<实际生成的四位码>`。

**截图内容：** 中央房间码、已加入成员、至少一个空座、统一规则摘要与房主 Start game。

**操作步骤：**

1. 房主提交 Screenshot 04 的表单并进入等待房间。
2. 另外两个独立账号通过 `/rooms/join` 输入实际房间码加入。
3. 在成员端点击空座换位，让所有客户端完成同步；保持四座三人以留下空位。
4. 返回房主可见页面，必要时点击 Copy 显示 Copied。
5. 在点击 Start game 前截取桌面牌桌与设置侧栏。

**推荐展示状态：** 三位成员已自动准备、一个空座；房间码必须实际生成。需要三个账号、API／数据库；轮询只刷新可见页，切回页面后等待一次刷新。

**这张截图说明什么：** 房间共享、选座和房主统一开始的准备阶段。

**相关代码：** `src/app/rooms/[roomCode]/page.tsx`、`src/components/table/poker-table.tsx`、`server/src/modules/rooms/room.service.ts`。

### Screenshot 06 — 线上牌桌的行动与私有底牌

**页面：** `/online?room=<实际房间码>`。

**截图内容：** 玩家筹码／位置、中央公共牌与底池、本人两张底牌、当前回合下注按钮和上一动作提示。

**操作步骤：**

1. 房主在等待页点击 Start game，确认房间创建时选择了 Online play。
2. 各账号按提示完成翻牌前跟注，最后大盲过牌，进入 flop。
3. 选用当前轮到行动的账号保持页面可见；未到本人回合时不会出现下注操作区。
4. 保持三张公共牌与本人底牌已显示，等状态稳定。
5. 截桌面牌桌与右侧操作栏；手机补图须让下方操作区进入画面。

**推荐展示状态：** 至少三人、已投入底池、尚未结算；牌面随机，不要求特定花色／组合。需要多人独立账号和正常 API／数据库。

**这张截图说明什么：** 服务端发牌、按阶段公开牌、本人回合权限和共享下注状态。

**相关代码：** 房间适配器、`src/components/table/online-my-hole-cards.tsx`、`src/components/actions/bottom-action-panel.tsx`、`server/src/modules/rooms/deck.ts`。

### Screenshot 07 — 自动牌力与最佳五张结果

**页面：** 同一个 `/online?room=<实际房间码>` 的 settled 状态。

**截图内容：** 自动结算提示、五张公共牌、玩家底牌与本手净变化、结果区牌型名称和最佳五张。

**操作步骤：**

1. 接 Screenshot 06，让仍参与手牌的玩家在 flop、turn、river 依次过牌到摊牌。
2. 等服务端自动结算并将主内容切换成结果视图。
3. 保持房主页面可见，暂停下一手或结束归档。
4. 将完整牌桌和至少两位玩家的结果卡片纳入桌面截图；内容太长可分区域。

**推荐展示状态：** 至少两人未弃牌，以便展示牌力对比；自然生成有辨识度的牌型即可。若需要平局／特殊牌型，需要继续真实对局，当前无可确认的指定发牌入口。

**这张截图说明什么：** 确定性牌力评估及从牌面到筹码结果的对应关系；不是 AI 生成。

**相关代码：** `src/components/table/online-hand-settlement-view.tsx`、`server/src/modules/rooms/hand-evaluator.ts`、`room.service.ts` 的 `settleCurrentHand`。

### Screenshot 08 — 个人资料与已归档统计

**页面：** `/profile`。

**截图内容：** 正常昵称／头像、Total Assets、Session Totals、非空历史列表和中英文选择。

**操作步骤：**

1. 在已结算房间中由房主点击 End Session & Archive。
2. 参与者打开 `/profile`，等待资料与历史加载。
3. 用 demo 图片上传头像并点击 Save Profile，确认保存成功。
4. 如需丰富历史，真实完成并归档另外 1–2 个房间；不要只开始下一手。
5. 截取桌面双列布局；手机补图可聚焦资料和统计。

**推荐展示状态：** 1–3 个真实 demo 归档、非零盈亏、已保存头像；使用专用账号，避免私人邮箱进入画面。Total Assets 是累计计分公式。

**这张截图说明什么：** 账号资料、头像处理和牌局结果的长期记录。

**相关代码：** `src/app/profile/page.tsx`、`server/src/modules/profile/profile.service.ts`、`room.service.ts` 的 `finalizeRoomAndArchive`。

### Screenshot 09 — 整局与逐手历史明细

**页面：** `/history/<从历史列表进入的真实 sessionId>`。

**截图内容：** 房间与时间、本人起止筹码和盈亏、整桌玩家结果、至少两手逐手结果。

**操作步骤：**

1. 用参与该房间的账号完成至少两手；第一手结算后由房主 Start Next Hand。
2. 第二手结算后由房主 End Session & Archive。
3. 进入 `/history`，点击刚归档的记录，使用真实链接而不是房间码作为 sessionId。
4. 等详情加载，桌面截整局／整桌结果；另一个裁切区域展示 Hand-by-Hand。

**推荐展示状态：** 两手或更多、有输赢的多人 demo；当前详情是筹码结果列表，没有已实现的逐动作回放播放器。

**这张截图说明什么：** 从单手动作、结算到整局记录的结果闭环。

**相关代码：** `src/app/history/[sessionId]/page.tsx`、`server/src/modules/profile/profile.service.ts` 的 `getSessionDetail`、`server/prisma/schema.prisma`。

## 14. Important Files Reference

| 阅读目的 | 文件／目录 |
| --- | --- |
| 项目定位、实际用户与运行方法 | `README.md`、`PRODUCT.md`、`package.json`、`server/package.json` |
| 当前设计、页面策略与历史验收记录 | `DESIGN.md`、`docs/surfaces/entry-redesign.md`；旧规格／迁移计划只作历史参考 |
| 入口与主要路由 | `src/app/page.tsx`、`src/app/online/page.tsx`、`src/app/local/page.tsx`、`src/app/rooms/`、`src/app/auth/`、`src/app/profile/`、`src/app/history/` |
| 共享牌桌边界 | `src/features/table/mode/types.ts`、`src/features/table/presentation/table-mode-screen.tsx` |
| 本地逻辑与保存 | `src/features/table/useTableController.ts`、`src/features/table/rules.ts`、`src/features/table/snapshot.ts`、`src/features/persistence/storage.ts`、`src/store/` |
| 本地／服务端适配 | `src/features/table/adapters/useLocalTableModeAdapter.tsx`、`src/features/table/adapters/useOnlineRoomTableModeAdapter.tsx` |
| REST 与房间同步 | `src/features/auth/api.ts`、`src/features/rooms/api.ts`、`src/features/rooms/realtime.ts`、`server/src/realtime/` |
| 服务端规则与生命周期 | `server/src/modules/rooms/room.routes.ts`、`room.schemas.ts`、`room.service.ts`、`betting-round.ts` |
| 发牌与牌力 | `server/src/modules/rooms/deck.ts`、`server/src/modules/rooms/hand-evaluator.ts` |
| 认证及个人历史 | `server/src/modules/auth/`、`server/src/modules/profile/` |
| 数据库真实结构与演进 | `server/prisma/schema.prisma`、`server/prisma/migrations/`；`docs/database-schema.md` 是早期草案 |
| 牌桌、牌、座位与动作 UI | `src/components/table/`、`src/components/player/`、`src/components/pot/`、`src/components/cards/`、`src/components/actions/`、`src/components/settlement/` |
| 主题、响应式与语言 | `src/app/globals.css`、`src/styles/`、`src/lib/table-layout.ts`、`src/components/i18n/language-provider.tsx`、`src/app/layout.tsx` |
| Vercel／独立服务器启动 | `src/pages/api/[...path].js`、`server/src/app.ts`、`server/src/index.ts`、`next.config.ts`、`vercel.json`、`scripts/migrate-vercel.mjs` |
| 开发与部署说明 | `.env.example`、`server/.env.example`、`docs/local-dev.md`、`docs/deployment-vercel.md`、`docs/deployment-railway-neon.md` |
| 已有测试 | `tests/poker-rules.test.ts`、`tests/table-layout.test.ts`、`tests/room-settings.test.ts`、`tests/room-sync.test.ts`；单独 opt-in：`tests/room-lifecycle.integration.ts` |
| 历史媒体 | `docs/screenshots/`、`docs/assets/online-table-demo.gif`；仅作参考，未确认当前视觉一致性 |

阅读时不要将 `useOnlineShellTableModeAdapter.ts`、`online-table-placeholders.tsx`、`history-page-placeholder.tsx` 等未接入当前路由的旧组件视为正在运行的页面，也不要因文件名带 placeholder 就判定当前手动结算弹窗未实现。
