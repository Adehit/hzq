# 海战棋(Battleship)

当前版本：0.0.1

本项目为莆田第一中学第一届3099知识竞赛决赛“海战棋”环节所使用的程序。

> 由于该程序的赶工性和（可能的）单次使用性，其存在大量冗余无用代码与不规范的书写格式，另外还包括极其困难的操作。由于各种原因，**作者无法保证继续对其进行维护**。

以下列出已知的功能性问题（缺陷）以供参考：
* 键盘点击开火事件不包括 $x$ 坐标和 $y$ 坐标为 $10$ 的情况，故暂定需要手点。另外，可能的解决方案为，将 $10$ 映射到按键 `0` 。
* 不支持撤销和重做功能，如需使用请谨慎点击。可能的解决方案为，自己在 `script.js` 中用栈等数据结构实现。
