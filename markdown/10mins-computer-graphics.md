!!meta-define:ident:10-minutes-computer-graphics
!!meta-define:title:十分钟计算机图形学
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-07-26T22:30:15+08:00
!!meta-define:tags:图形学,软件渲染器,Julia
!!meta-define:brief:七通设计算机图形学与 Vk 入门专用教材，你还在等什么，<del>赶紧拨打热线电话订购吧！</del>

计算机图形学，从应用的角度上来说，其实是一种非常简单的技术。不幸的是，现有的教程通常会在一开始拘泥于一些数学上的问题，或者执着于一些数学上的细节。本教程尝试通过另一种方式，借由一个基本软件渲染器的实现，概览整个渲染管线，来介绍计算机图形学的基本概念。

## 计算机图形学

简单来说，计算机图形学的*意图*就是将一系列的图元（点、线、三角形，以及它们的空间位置、颜色属性）转化为屏幕上的像素点。这个转换的过程被称为*渲染*。

<div class="img-container">
<img src="/extra/blog-images/basic-rasterization.png" alt="光栅化" width="531" height="265"/>
</div>

本教程中，我们会使用 Julia 实现一个基本的软件渲染器，它能*光栅化*基本的三角形图元，并且能够以*可编程*的方式配置一部分渲染管线。

## 准备工作

在开工之前，我们需要先准备一些东西。首先，创建一个 Julia 文件，然后在里面开一个模块：

```julia
module Softpipe

# 之后我们的代码都会放到这里面

end # module Softpipe
```

之所以要开这个模块，是因为在 Julia REPL 中求值脚本的时候，脚本中的类型、函数和变量会被引入到 REPL 的顶层作用域中。之后重新求值这个脚本的时候，原先的定义也不会消失，并且以各种形式干扰重新求值的过程。如果把所有东西包在一个模块里，重新求值脚本就能完全地替换模块中的内容，从而避免上述问题。

接着，我们引入需要的包：

```julia
# CG 中的线性代数运算经常需要一些定长的向量和矩阵
using StaticArrays
# 由 MWORKS.Syslab 2023b 提供，仅用于最后阶段显示图片，你也可以替换成其他库
using TyImages

# 常用尺寸的向量
# CG 渲染不需要太高的精度，并且 32 位浮点数的使用非常广泛
# 而且这样我们可以少担心一点类型稳定性的问题
const Vec2 = SVector{2,Float32}
const Vec3 = SVector{3,Float32}
const Vec4 = SVector{4,Float32}

# 常用的 4x4 矩阵
const Mat4x4 = SMatrix{4,4,Float32}

# 帧缓冲，记录每个像素点上的颜色
const Framebuffer = Matrix{Vec4}
# 深度缓冲，记录每个像素点上的深度值，之后我们会看到它的作用
const Depthbuffer = Matrix{Float32}
```

## `render!` 函数

如果“渲染”是一个函数的话，回顾我们刚讲过*意图*：

> 简单来说，计算机图形学的*意图*就是将一系列的图元（点、线、三角形，以及它们的空间位置、颜色属性）转化为屏幕上的像素点

那么，这个函数的签名也就呼之欲出了：

```julia
function render!(
    # 目标帧缓冲，或者可以理解为“画布”
    framebuffer::Framebuffer,
    # 顶点数据。注意定点数据不止包含位置，还可以包含用户定义的任意属性
    # 所以这里使用一个泛型参数来表示顶点类型
    vertices::Vector{V}

    # 这些还不是全部，我们会在后面添加更多参数
) where {V}
    width = size(framebuffer, 2)
    height = size(framebuffer, 1)
    vertex_count = length(vertices)

    # 做一些基本的检查
    @assert width > 0 && height > 0
    @assert vertex_count > 0
    # 本文中我们只讨论三角形
    # 多边形可以视为多个三角形的组合，线段则使用另外的算法，本文暂不讨论
    @assert vertex_count % 3 == 0
end
```

## 准备数据

接下来，我们准备一点供我们渲染的数据，就从一个彩色三角形开始：

```julia
# 三角形顶点的属性
struct Vertex
    # 位置，我们暂时只用到 x 和 y，所以两个分量就够了
    position::Vec2
    # 颜色，我们暂时不用透明度，所以三个分量就够了
    color::Vec3
end

# 我们采用和 OpenGL 相同的坐标系，即 y 轴向上，z 轴向屏幕外
vertices = [
    Vertex(Vec2(-1.0, -1.0), Vec3(1.0, 0.0, 0.0)),
    Vertex(Vec2(1.0, -1.0), Vec3(0.0, 1.0, 0.0)),
    Vertex(Vec2(0.0, 1.0), Vec3(0.0, 0.0, 1.0))
]
```

## 顶点变换与顶点着色器

在渲染过程中，我们要做的第一件事就是将所有顶点的坐标，根据我们“看”这个顶点的角度以及摄像头的配置，将其转换到一个 `(-1, 1) × (-1, 1)` 的区域内的坐标。数学上来说，这会涉及到几个变换矩阵和一系列线性代数运算。本文中我们不会讨论数学上的问题，只讨论工程问题 —— 即这些东西如何体现在代码中，更确切地说，如何体现在图形管线的 API 里。

在一些旧的图形 API，例如 OpenGL 1.x 中，顶点的属性是由类似这样的一系列函数来“设置”的：

```c
glBegin(GL_TRIANGLES);
    glColor3f(1.0f, 0.0f, 0.0f);
    glVertex2f(-1.0f, -1.0f);

    glColor3f(0.0f, 1.0f, 0.0f);
    glVertex2f(1.0f, -1.0f);

    glColor3f(0.0f, 0.0f, 1.0f);
    glVertex2f(0.0f, 1.0f);
glEnd();
```

而各种变换矩阵也是通过类似的 API 来设置的：

```c
glMatrixMode(GL_PROJECTION);              // 告诉 OpenGL 接下来我们要操作投影矩阵
glLoadIdentity();                         // 重置为单位矩阵
glPerspective(45.0f, 1.0f, 0.1f, 100.0f); // 设置投影矩阵

glMatrixMode(GL_MODELVIEW);               // 告诉 OpenGL 接下来我们要操作模型-视图矩阵
glLoadIdentity();                         // 重置为单位矩阵
glTranslatef(0.5f, 0.0f, 5.0f);           // 平移变换
// 添加
```

显然，这样做是有很大局限性的
- 我们所能设置的属性种类（位置、颜色、纹理坐标等）是有限的，并且完全地受限于 OpenGL API 本身的功能
- 我们能进行的变换也是有限的，在顶点变换阶段只有“给顶点乘一个矩阵来进行变换”这一种操作

因此，各大图形 API 都陆续引入了*可编程*的部分。简单来说，就是允许用户向图形 API 提交一段自己写的程序（你可以理解为“回调函数”，接下来我们也会这么实现），当图形 API 需要执行某个操作的时候就调用这段程序，这样用户就能为所欲为做对数据做自己想做的处理了。这段程序就是*着色器*。而用于变换顶点数据的着色器就是*顶点着色器*。

顶点着色器要接受一个顶点的所有属性，返回顶点在 `(-1, 1) × (-1, 1)` 区域内的坐标，以及其他属性。例如，我们可以编写这样一个顶点着色器：

```julia
mutable struct ManipulatedVertex
    position::Vec4 # 我们统一输出 Vec4，这样后续步骤会更统一
    color::Vec3    # 顶点颜色

    ManipulatedVertex() = new()
    ManipulatedVertex(position::Vec4, color::Vec3) = new(position, color)
end

function vertex_shader_identity(vertex::Vertex)::ManipulatedVertex
    ManipulatedVertex(
        # 顶点位置不变，补上 z 和 t 分量
        Vec4(vertex.position[0], vertex.position[1], 0.0, 1.0),
        # 顶点颜色不变
        vertex.color
    )
end
```

那么，我们修改 `render!` 函数的签名，让它接受一个代表“顶点着色器”的函数：

```julia
function render!(
    framebuffer::Framebuffer,
    vertices::Vector{V},
    # 顶点着色器
    vertex_shader::VS,
) where {V, VS <: Function}
    # ...
end
```

然后，我们就可以在 `render!` 函数中调用这个着色器了：

```julia
    # ...

    vs_outputs = map(vertex_shader, vertices)
    # 在这之后，“正规化”着色器输出的顶点位置。不用太在意数学上发生了什么
    for i in 1:vertex_count
        vs_outputs[i].position /= vs_outputs[i].position.w
    end
```

## 光栅化

接下来，我们把变换后的顶点转换为屏幕上实际的像素了。我们每次渲染一个三角形：

```julia
    for i in 1:3:vertex_count
        # 三角形的三个顶点
        v1 = vs_outputs[i]
        v2 = vs_outputs[i + 1]
        v3 = vs_outputs[i + 2]

        # 三个顶点的位置
        v1_pos = v1.position::Vec4
        v2_pos = v2.position::Vec4
        v3_pos = v3.position::Vec4

        # 计算三角形的包围盒
        min_x = min(v1_pos[1], v2_pos[1], v3_pos[1])
        min_y = min(v1_pos[2], v2_pos[2], v3_pos[2])
        max_x = max(v1_pos[1], v2_pos[1], v3_pos[1])
        max_y = max(v1_pos[2], v2_pos[2], v3_pos[2])

        # 将包围盒的坐标转换为帧缓冲上像素的坐标
        min_x_pix = round(Int, (min_x + 1.0) * width / 2.0)
        min_y_pix = round(Int, (min_y + 1.0) * height / 2.0)
        max_x_pix = round(Int, (max_x + 1.0) * width / 2.0)
        max_y_pix = round(Int, (max_y + 1.0) * height / 2.0)

        # 确保包围盒在帧缓冲内
        min_x_pix = max(min_x_pix, 1)
        min_y_pix = max(min_y_pix, 1)
        max_x_pix = min(max_x_pix, width)
        max_y_pix = min(max_y_pix, height)

        # 对包围盒内的每个像素点进行处理
        for y_pix in min_y_pix:max_y_pix
            for x_pix in min_x_pix:max_x_pix
                # Question: 这个像素是否在三角形内？如果在，我们应该把它填充成什么颜色？
            end
        end
    end
```

现在还差一个问题：如何判断一个像素是否在三角形内？如果这个像素在三角形内，我们应该把它填充成什么颜色？

## 重心坐标与插值

简单来说，如果我们有三个点 `(x1, y1)`，`(x2, y2)`，`(x3, y3)`，那么平面内的任意一个点 `(x, y)` 都可以表示为：

```
(x, y) = w1 * (x1, y1) + w2 * (x2, y2) + w3 * (x3, y3)
```

我们把 `w` 抽出来，那么 `(w1, w2, w3)` 就是 `(x, y)` 在三个点上的*重心坐标*。如果 `(w1, w2, w3)` 的每个分量都为正，那么 `(x, y)` 就在三角形内。详细的数学推导过程可以参见[这篇博客](https://codeplea.com/triangular-interpolation)，本文依旧无视这些细节。以下是 Julia 代码实现：

```julia
# 重心坐标计算
function barycentric(
    v1::V,
    v2::V,
    v3::V,
    v::V
)::Tuple{Float32,Float32,Float32} where {V <: AbstractVector}
    denom = (v2[2] - v3[2]) * (v1[1] - v3[1]) + (v3[1] - v2[1]) * (v1[2] - v3[2])

    w1 = ((v2[2] - v3[2]) * (v[1] - v3[1]) + (v3[1] - v2[1]) * (v[2] - v3[2])) / denom
    w2 = ((v3[2] - v1[2]) * (v[1] - v3[1]) + (v1[1] - v3[1]) * (v[2] - v3[2])) / denom
    w3 = 1.0 - w1 - w2

    return (w1, w2, w3)
end
```

重心坐标还有一个意义，那就是三个点的数据对于这个点的*影响程度*，或者说*权重*。有了重心坐标，实现插值就像呼吸一样简单：

```julia
# 基于重心坐标的插值
function interpolate3(p::Vec2, v1::T, v2::T, v3::T)::Union{T,Nothing} where {T}
    # 这里用了一些 Julia 的反射机制，不用在意
    @assert hasfield(T, :position)
    @assert isa(v1.position, Vec4)

    v1_xy = v1.position[1:2]
    v2_xy = v2.position[1:2]
    v3_xy = v3.position[1:2]

    w1, w2, w3 = barycentric(v1_xy, v2_xy, v3_xy, p)
    if w1 < 0.0 || w2 < 0.0 || w3 < 0.0
        return nothing
    end

    ret = T()
    for field in fieldnames(T)
        v1_field = getfield(v1, field)
        v2_field = getfield(v2, field)
        v3_field = getfield(v3, field)
        setfield!(ret, field, w1 * v1_field + w2 * v2_field + w3 * v3_field)
    end
    return ret
end
```

现在，我们已经知道了三角形内某个像素点的所有属性。我们暂时跳过深度测试，接下来就剩一件事要做了：通过这个像素点的属性，确定这个像素点的颜色。

## 片元着色器

和顶点着色器一样，片元着色器旨在为图形管线增加可编程特性，从而让用户能够自定义渲染管线的行为。片元着色器接受一个像素点的所有属性作为输入，输出这个像素点的颜色。我们可以这样实现一个简单的片元着色器：

```julia
function fragment_shader_identity(fragment::ManipulatedVertex)::Vec4
    return Vec4(
        fragment.color[1],
        fragment.color[2],
        fragment.color[3],
        1.0
    )
end
```

接着我们修改 `render!` 函数的签名，让它再接受一个代表“片元着色器”的函数：

```julia
function render!(
    framebuffer::Framebuffer,
    vertices::Vector{V},
    vertex_shader::VS,
    # 片元着色器
    fragment_shader::FS,
) where {V, VS <: Function, FS <: Function}
    # ...
end
```

终于，我们可以着手完成 `render!` 函数中间那个循环里最后一步了：

```julia
        for y_pix in min_y_pix:max_y_pix
            for x_pix in min_x_pix:max_x_pix
                x = 2.0 * x_pix / width - 1.0
                y = 2.0 * y_pix / height - 1.0

                # 通过重心坐标插值得到这个像素点的属性
                fragment = interpolate3(Vec2(x, y), v1, v2, v3)

                # 如果这个像素点不在三角形内，就跳过
                if isnothing(fragment)
                    continue
                end

                # 运行片元着色器，得到这个像素点的颜色
                color = fragment_shader(fragment)
                # 将颜色写入帧缓冲
                framebuffer[y_pix, x_pix] = color
            end
        end
```

在这之后，我们就可以着手进行组装：

```julia
framebuffer = zeros(Vec4, 512, 512)
render!(framebuffer, vertices, vertex_shader_identity, fragment_shader_identity)
```

## 显示图像 (Syslab 限定)

以下函数用于将帧缓冲转换为 `TyImage.imshow` 能显示的格式，你可以不用太在意具体细节。如果你选择用其他库来显示图像，你可能也需要自己实现一个类似的函数。

```julia
function packed2planar(packed::Framebuffer)::Array{Float32,3}
    ret = Array{Float32}(undef, size(packed, 1), size(packed, 2), 3)

    height = size(packed, 1)
    width = size(packed, 2)

    for i in 1:height
        for j in 1:width
            ret[i, j, 1] = packed[height-i+1, j][1]
            ret[i, j, 2] = packed[height-i+1, j][2]
            ret[i, j, 3] = packed[height-i+1, j][3]
        end
    end

    return ret
end

imshow(packed2planar(framebuffer))
```

## 总结

大功告成！你现在应该已经看到了一个彩色三角形了。如果你在哪一步遇到了问题，可以参考 [完整代码](/extra/code/10mins-computer-graphics/10mins-computer-graphics.jl)。

到目前为止，我们已经实现了一个基本的软件渲染器，但还有很多事情没有做。例如，我们还没有实现深度测试，也没有利用我们的可编程功能做一些更有趣的事情。但是，我们已经完成了本文的目标：概览整个渲染管线，介绍计算机图形学的基本概念。*敬请期待之后的更多作品，咕咕咕，咕咕咕咕咕咕。*
