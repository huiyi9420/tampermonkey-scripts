# CoolCollege 作答详情解锁

解锁酷学院（致远学院）考试数据页面中灰色不可点击的「作答详情」按钮，支持查看所有考试记录（无论及格与否）的作答详情。

## 功能说明

- 自动检测考试数据页面中 `show_record === "false"` 的灰色「作答详情」按钮
- 将灰色按钮变为蓝色可点击状态
- 点击后在新标签页打开对应记录的作答详情页面
- 支持 SPA 路由切换，无需手动刷新页面

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开 [coolcollege-unlock.user.js](./coolcollege-unlock.user.js) 并点击 Raw 按钮
3. Tampermonkey 会自动弹出安装提示，点击确认

## 使用方法

1. 登录 [酷学院](https://pro.coolcollege.cn/) 平台
2. 进入任意考试的「考试数据」页面
3. 脚本自动激活，灰色按钮将变为蓝色可点击
4. 点击即可查看作答详情

## 技术实现

- **MutationObserver** 监听 DOM 变化，检测动态加载的表格行
- **React Fiber** 提取行内 record 数据（submit_id、show_record 等）
- **window.onurlchange** 检测 SPA 路由切换
- 300ms 尾部去抖 + `data-processed` 标记防止重复处理

## 兼容性

- 浏览器：Chrome / Firefox / Edge（需安装 Tampermonkey）
- 站点：`pro.coolcollege.cn`

## 许可证

MIT