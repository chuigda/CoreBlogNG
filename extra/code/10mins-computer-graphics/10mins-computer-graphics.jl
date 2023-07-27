module Softpipe

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
# 深度缓冲，记录每个像素点上的深度值
const Depthbuffer = Matrix{Float32}

# 重心坐标计算
function barycentric(
    v1::V,
    v2::V,
    v3::V,
    v::Vec2
)::Tuple{Float32,Float32,Float32} where {V<:AbstractVector}
    denom = (v2[2] - v3[2]) * (v1[1] - v3[1]) + (v3[1] - v2[1]) * (v1[2] - v3[2])

    w1 = ((v2[2] - v3[2]) * (v[1] - v3[1]) + (v3[1] - v2[1]) * (v[2] - v3[2])) / denom
    w2 = ((v3[2] - v1[2]) * (v[1] - v3[1]) + (v1[1] - v3[1]) * (v[2] - v3[2])) / denom
    w3 = 1.0 - w1 - w2

    return (w1, w2, w3)
end

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

function render!(
    # 目标帧缓冲，或者可以理解为“画布”
    framebuffer::Framebuffer,
    # 顶点数据。注意定点数据不止包含位置，还可以包含用户定义的任意属性
    # 所以这里使用一个泛型参数来表示顶点类型
    vertices::Vector{V},
    # 顶点着色器
    vertex_shader::VS,
    # 片段着色器
    fragment_shader::FS
) where {V,VS<:Function,FS<:Function}
    width = size(framebuffer, 2)
    height = size(framebuffer, 1)
    vertex_count = length(vertices)

    # 做一些基本的检查
    @assert width > 0 && height > 0
    @assert vertex_count > 0
    # 本文中我们只讨论三角形
    # 多边形可以视为多个三角形的组合，线段则使用另外的算法，本文暂不讨论
    @assert vertex_count % 3 == 0

    vs_outputs = map(vertex_shader, vertices)
    # 在这之后，“正规化”着色器输出的顶点位置。不用太在意数学上发生了什么
    for i in 1:vertex_count
        vs_outputs[i].position /= vs_outputs[i].position.w
    end

    for i in 1:3:vertex_count
        # 三角形的三个顶点
        v1 = vs_outputs[i]
        v2 = vs_outputs[i+1]
        v3 = vs_outputs[i+2]

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
    end
end

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

mutable struct ManipulatedVertex
    position::Vec4 # 我们统一输出 Vec4，这样后续步骤会更统一
    color::Vec3    # 顶点颜色

    ManipulatedVertex() = new()
    ManipulatedVertex(position::Vec4, color::Vec3) = new(position, color)
end

function vertex_shader_identity(vertex::Vertex)::ManipulatedVertex
    ManipulatedVertex(
        # 顶点位置不变，补上 z 和 t 分量
        Vec4(vertex.position[1], vertex.position[2], 0.0, 1.0),
        # 顶点颜色不变
        vertex.color
    )
end

function fragment_shader_identity(fragment::ManipulatedVertex)::Vec4
    return Vec4(
        fragment.color[1],
        fragment.color[2],
        fragment.color[3],
        1.0
    )
end

framebuffer = zeros(Vec4, 512, 512)
render!(framebuffer, vertices, vertex_shader_identity, fragment_shader_identity)

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

end # module Softpipe
