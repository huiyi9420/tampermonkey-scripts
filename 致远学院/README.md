# CoolCollege 作答详情解锁

解锁酷学院（致远学院）考试数据页面中灰色不可点击的「作答详情」按钮，支持查看所有考试记录（无论及格与否）的作答详情。

## 脚本列表

| 脚本 | 说明 |
|------|------|
| [coolcollege-unlock.user.js](./coolcollege-unlock.user.js) | **合集** — 包含全部3个功能 |
| [coolcollege-unlock-only.user.js](./coolcollege-unlock-only.user.js) | **独立** — 作答详情解锁 |
| [coolcollege-download-only.user.js](./coolcollege-download-only.user.js) | **独立** — 下载试题 |
| [coolcollege-upload-only.user.js](./coolcollege-upload-only.user.js) | **独立** — 上传题库 |

## 功能说明

### 作答详情解锁

- 自动检测考试数据页面中灰色「作答详情」按钮（show_record 为 false）
- 将灰色按钮变为蓝色可点击状态
- 点击后在新标签页打开对应记录的作答详情页面

### 下载试题

- 在每行添加「下载试题」按钮
- 一键获取完整试题 JSON 数据（含题目、选项、答案、解析）
- 文件名格式：姓名_考试题目_成绩_作答时长_交卷时间.json

### 上传题库

- 在每行添加「上传题库」按钮
- 自动获取试题数据并上传到题库系统（question.a2008q.top）
- 上传成功后显示导入题数（如「成功50题」）
- 首次使用需在题库系统登录，token 自动同步

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击上方对应脚本链接
3. 点击 Raw 按钮即可安装

> 建议安装合集脚本，或按需安装独立脚本。独立脚本互不干扰，可同时启用。

## 使用方法

1. 登录 [酷学院](https://pro.coolcollege.cn/) 平台
2. 进入任意考试的「考试数据」页面
3. 脚本自动激活，按钮显示在每行操作列

### 上传题库首次使用

1. 点击「上传题库」按钮
2. 系统自动打开题库网站，完成登录
3. 切回酷学院考试数据页面
4. 再次点击「上传题库」即可

## 技术实现

- **MutationObserver** 监听 DOM 变化，检测动态加载的表格行
- **React Fiber** 提取行内 record 数据（submit_id、show_record 等）
- **window.onurlchange** 检测 SPA 路由切换
- **GM_setValue/GM_getValue** 跨域同步题库系统 token
- 300ms 尾部去抖 + 独立 data-*-processed 标记防止重复处理

## 兼容性

- 浏览器：Chrome / Firefox / Edge（需安装 Tampermonkey）
- 站点：pro.coolcollege.cn / question.a2008q.top（上传题库）

## 许可证

MIT