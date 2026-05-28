# excalidraw 箭头相关位置计算逻辑梳理

## 变量说明
- `startEle` - 起点绑定的元素
- `endEle` - 终点绑定的元素
- `arrow` - 箭头元素

## 属性和计算公式
- 箭头起点x = `arrow.x`
- 箭头起点y = `arrow.y`
- 箭头终点x = `arrow.x + arrow.width`
- 箭头终点y = `arrow.y + arrow.height`

## 核心计算逻辑

### 元素中心点计算
```javascript
// 元素中心点坐标
const startCenterX = startX + startWidth / 2;
const startCenterY = startY + startHeight / 2;
const endCenterX = endX + endWidth / 2;
const endCenterY = endY + endHeight / 2;
```

### 距离变量定义（基于中心点）
```javascript
// dx和dy仅用于确定元素的相对位置方向
const dx = startCenterX - endCenterX;  // 或 endCenterX - startCenterX (取决于计算哪个元素)
const dy = startCenterY - endCenterY;  // 或 endCenterY - startCenterY (取决于计算哪个元素)
const absDx = Math.abs(dx);
const absDy = Math.abs(dy);
```

### 边缘中点计算公式
- **左边缘中点**: `{ x: element.x, y: element.y + element.height / 2 }`
- **右边缘中点**: `{ x: element.x + element.width, y: element.y + element.height / 2 }`
- **上边缘中点**: `{ x: element.x + element.width / 2, y: element.y }`
- **下边缘中点**: `{ x: element.x + element.width / 2, y: element.y + element.height }`

---

## 如何确定箭头起点坐标
箭头起点坐标的位置应为 `startEle` 的边缘的中点位置。

### 新的边缘选择算法
1. **确定相对位置**：使用中心点坐标计算 `dx` 和 `dy`，仅用于确定两个元素的相对位置方向
2. **候选边缘配对**：基于相对位置确定候选的相反边缘对
3. **边缘选择**：计算各候选边缘对的坐标差值，选择差值最大的边缘对

#### 步骤1：计算元素中心点和相对位置
```javascript
const startCenterX = startX + startWidth / 2;
const startCenterY = startY + startHeight / 2;
const endCenterX = endX + endWidth / 2;
const endCenterY = endY + endHeight / 2;

const dx = startCenterX - endCenterX;
const dy = startCenterY - endCenterY;
```

#### 步骤2：确定候选边缘对
基于相对位置确定候选的相反边缘配对：

| startEle 相对位置 | startEle 候选边缘 | endEle 候选边缘 | 关系 |
|------------------|-----------------|---------------|------|
| 左方 (dx > 0) | 右边缘 | 左边缘 | 相反 |
| 右方 (dx < 0) | 左边缘 | 右边缘 | 相反 |
| 上方 (dy > 0) | 下边缘 | 上边缘 | 相反 |
| 下方 (dy < 0) | 上边缘 | 下边缘 | 相反 |

#### 步骤3：计算边缘差值并选择最优边缘

##### 横向边缘差值计算
```javascript
// 左右边缘的 X 轴距离差（注意：不使用绝对值，保持方向性）
const leftToRightDistance = (startX - (endX + endWidth));
const rightToLeftDistance = -((startX + startWidth) - endX);
```

##### 纵向边缘差值计算
```javascript
// 上下边缘的 Y 轴距离差（注意：不使用绝对值，保持方向性）
const topToBottomDistance = (startY - (endY + endHeight));
const bottomToTopDistance = -((startY + startHeight) - endY);
```

##### 边缘选择逻辑
```javascript
// 根据相对位置和最大差值确定边缘
if (dx > 0 && dy > 0) {
  // startEle 在 endEle 右下方
  if (leftToRightDistance > topToBottomDistance) {
    // 选择左右边缘对
    startEdge = 'left';
    endEdge = 'right';
  } else {
    // 选择上下边缘对
    startEdge = 'top';
    endEdge = 'bottom';
  }
} else if (dx < 0 && dy > 0) {
  // startEle 在 endEle 左下方
  if (rightToLeftDistance > topToBottomDistance) {
    startEdge = 'right'; endEdge = 'left';
  } else {
    startEdge = 'top'; endEdge = 'bottom';
  }
} else if (dx > 0 && dy < 0) {
  // startEle 在 endEle 右上方
  if (leftToRightDistance > bottomToTopDistance) {
    startEdge = 'left'; endEdge = 'right';
  } else {
    startEdge = 'bottom'; endEdge = 'top';
  }
} else if (dx < 0 && dy < 0) {
  // startEle 在 endEle 左上方
  if (rightToLeftDistance > bottomToTopDistance) {
    startEdge = 'right'; endEdge = 'left';
  } else {
    startEdge = 'bottom'; endEdge = 'top';
  }
} else if (dx === 0 && dy > 0) {
  // 直接在下方
  startEdge = 'top'; endEdge = 'bottom';
} else if (dx === 0 && dy < 0) {
  // 直接在上方
  startEdge = 'bottom'; endEdge = 'top';
} else if (dx > 0 && dy === 0) {
  // 直接在右方
  startEdge = 'left'; endEdge = 'right';
} else if (dx < 0 && dy === 0) {
  // 直接在左方
  startEdge = 'right'; endEdge = 'left';
} else {
  // 默认情况（重叠元素）
  startEdge = 'right'; endEdge = 'left';
}
```

#### 完整的边缘选择算法
```javascript
function determineEdges(startEle, endEle) {
  const startX = startEle.x || 0;
  const startY = startEle.y || 0;
  const startWidth = startEle.width || 100;
  const startHeight = startEle.height || 100;

  const endX = endEle.x || 0;
  const endY = endEle.y || 0;
  const endWidth = endEle.width || 100;
  const endHeight = endEle.height || 100;

  // 计算中心点坐标以准确确定相对位置
  const startCenterX = startX + startWidth / 2;
  const startCenterY = startY + startHeight / 2;
  const endCenterX = endX + endWidth / 2;
  const endCenterY = endY + endHeight / 2;

  // dx 和 dy 仅用于确定相对位置方向
  const dx = startCenterX - endCenterX;
  const dy = startCenterY - endCenterY;

  // 计算可能边缘配对之间的距离差
  const leftToRightDistance = (startX - (endX + endWidth));
  const rightToLeftDistance = -((startX + startWidth) - endX);
  const topToBottomDistance = (startY - (endY + endHeight));
  const bottomToTopDistance = -((startY + startHeight) - endY);

  let startEdge, endEdge;

  if (dx > 0 && dy > 0) {
    // startEle 在 endEle 右下方
    if (leftToRightDistance > topToBottomDistance) {
      startEdge = 'left'; endEdge = 'right';
    } else {
      startEdge = 'top'; endEdge = 'bottom';
    }
  } else if (dx < 0 && dy > 0) {
    // startEle 在 endEle 左下方
    if (rightToLeftDistance > topToBottomDistance) {
      startEdge = 'right'; endEdge = 'left';
    } else {
      startEdge = 'top'; endEdge = 'bottom';
    }
  } else if (dx > 0 && dy < 0) {
    // startEle 在 endEle 右上方
    if (leftToRightDistance > bottomToTopDistance) {
      startEdge = 'left'; endEdge = 'right';
    } else {
      startEdge = 'bottom'; endEdge = 'top';
    }
  } else if (dx < 0 && dy < 0) {
    // startEle 在 endEle 左上方
    if (rightToLeftDistance > bottomToTopDistance) {
      startEdge = 'right'; endEdge = 'left';
    } else {
      startEdge = 'bottom'; endEdge = 'top';
    }
  } else if (dx === 0 && dy > 0) {
    // 直接在下方
    startEdge = 'top'; endEdge = 'bottom';
  } else if (dx === 0 && dy < 0) {
    // 直接在上方
    startEdge = 'bottom'; endEdge = 'top';
  } else if (dx > 0 && dy === 0) {
    // 直接在右方
    startEdge = 'left'; endEdge = 'right';
  } else if (dx < 0 && dy === 0) {
    // 直接在左方
    startEdge = 'right'; endEdge = 'left';
  } else {
    // 默认情况（重叠元素）
    startEdge = 'right'; endEdge = 'left';
  }

  return { startEdge, endEdge };
}
```

---

## 如何确定箭头终点坐标
箭头终点坐标的位置应为 `endEle` 的边缘的中点位置。

**注意**：终点坐标的计算与起点坐标使用相同的边缘选择算法，确保两个元素选择的边缘始终是相反的方向。

### 基于边缘选择算法的终点计算
```javascript
// 使用相同的 determineEdges 函数获取边缘配对
const { endEdge } = determineEdges(startEle, endEle);

// 根据确定的 endEdge 计算终点坐标
function getEdgeCenter(element, edge) {
  const x = element.x || 0;
  const y = element.y || 0;
  const width = element.width || 100;
  const height = element.height || 100;

  switch (edge) {
    case 'left':
      return { x: x, y: y + height / 2 };
    case 'right':
      return { x: x + width, y: y + height / 2 };
    case 'top':
      return { x: x + width / 2, y: y };
    case 'bottom':
      return { x: x + width / 2, y: y + height };
    default:
      // 默认使用右边缘
      return { x: x + width, y: y + height / 2 };
  }
}

const endEdgeCenter = getEdgeCenter(endEle, endEdge);
```

---

## 最终箭头坐标计算

### 新的箭头坐标计算流程

```javascript
// 1. 确定最优边缘配对
const { startEdge, endEdge } = determineEdges(startEle, endEle);

// 2. 计算起点和终点的边缘中心坐标
function getEdgeCenter(element, edge) {
  const x = element.x || 0;
  const y = element.y || 0;
  const width = element.width || 100;
  const height = element.height || 100;

  switch (edge) {
    case 'left':
      return { x: x, y: y + height / 2 };
    case 'right':
      return { x: x + width, y: y + height / 2 };
    case 'top':
      return { x: x + width / 2, y: y };
    case 'bottom':
      return { x: x + width / 2, y: y + height };
    default:
      // 默认使用右边缘
      return { x: x + width, y: y + height / 2 };
  }
}

const startEdgeCenter = getEdgeCenter(startEle, startEdge);
const endEdgeCenter = getEdgeCenter(endEle, endEdge);

// 3. 设置箭头坐标
arrow.x = startEdgeCenter.x;
arrow.y = startEdgeCenter.y;
arrow.width = endEdgeCenter.x - startEdgeCenter.x;
arrow.height = endEdgeCenter.y - startEdgeCenter.y;

// 4. 修复 Excalidraw 渲染 bug：宽度为 0 时设为 1
if (arrow.width === 0) {
  arrow.width = 1;
}
```

### 专用函数简化版本
实际实现中还提供了专用的简化函数：

```javascript
// 获取起点元素的边缘中心点
function getStartEdgeCenter(startEle, endEle) {
  const { startEdge } = determineEdges(startEle, endEle);
  return getEdgeCenter(startEle, startEdge);
}

// 获取终点元素的边缘中心点
function getEndEdgeCenter(endEle, startEle) {
  const { endEdge } = determineEdges(startEle, endEle);
  return getEdgeCenter(endEle, endEdge);
}

// 使用专用函数的简化计算
const startEdgeCenter = getStartEdgeCenter(startEle, endEle);
const endEdgeCenter = getEndEdgeCenter(endEle, startEle);

arrow.x = startEdgeCenter.x;
arrow.y = startEdgeCenter.y;
arrow.width = endEdgeCenter.x - startEdgeCenter.x;
arrow.height = endEdgeCenter.y - startEdgeCenter.y;
```

### 核心改进点总结
1. **中心点计算**：dx 和 dy 基于元素中心点计算，更准确地反映元素间的相对位置
2. **边缘配对原则**：确保 startEle 和 endEle 的边缘始终是相反方向（左-右、上-下）
3. **距离差选择**：通过计算候选边缘对的坐标差值（保持方向性，不使用绝对值），选择差值最大的边缘对，优化连接路径
4. **统一算法**：起点和终点使用相同的边缘选择逻辑，保证一致性
5. **边界值处理**：为元素属性添加默认值（x=0, y=0, width=100, height=100）确保计算的鲁棒性
6. **特殊情况处理**：添加对直接上下左右对齐及重叠元素的特殊处理逻辑
7. **渲染修复**：修复 Excalidraw 渲染 bug，线类型元素宽度为 0 时设为 1

---

## 重要实现细节

### 1. 距离差计算的方向性
```javascript
// 注意：不使用 Math.abs()，保持方向性
const leftToRightDistance = (startX - (endX + endWidth));      // 正值表示间距
const rightToLeftDistance = -((startX + startWidth) - endX);   // 正值表示间距
```

### 2. 边缘选择的特殊情况处理
- **直接对齐**：当 dx=0 或 dy=0 时，直接选择对应的边缘对
- **重叠元素**：当元素重叠时，使用默认的右-左边缘配对
- **严格相反**：确保选择的边缘对始终是相反方向

### 3. 元素属性默认值
所有元素属性都使用 `|| 0` 或 `|| 100` 提供默认值：
```javascript
const startX = startEle.x || 0;
const startY = startEle.y || 0;
const startWidth = startEle.width || 100;
const startHeight = startEle.height || 100;
```

### 4. Excalidraw 渲染 Bug 修复
```javascript
// 修复 Excalidraw 渲染 bug：线类型元素宽度为 0 时设为 1
if ((element.type === 'arrow' || element.type === 'line') && optimized.width === 0) {
  optimized.width = 1;
  needsOptimization = true;
}
```

## 实现位置
完整实现见：`lib/optimizeArrows.js`
