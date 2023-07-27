module Softpipe

using Base.Threads
using Distributed
using StaticArrays
using TyImages

const Vec2 = SVector{2,Float32}
const Vec3 = SVector{3,Float32}
const Vec4 = SVector{4,Float32}
const Mat4x4 = SMatrix{4,4,Float32}

function rotate_x(angle::Number)::Mat4x4
    return Mat4x4(
        1.0, 0.0, 0.0, 0.0,
        0.0, cosd(angle), sind(angle), 0.0,
        0.0, -sind(angle), cosd(angle), 0.0,
        0.0, 0.0, 0.0, 1.0
    )
end

function rotate_y(angle::Number)::Mat4x4
    return Mat4x4(
        cosd(angle), 0.0, -sind(angle), 0.0,
        0.0, 1.0, 0.0, 0.0,
        sind(angle), 0.0, cosd(angle), 0.0,
        0.0, 0.0, 0.0, 1.0
    )
end

function rotate_z(angle::Number)::Mat4x4
    return Mat4x4(
        cosd(angle), sind(angle), 0.0, 0.0,
        -sind(angle), cosd(angle), 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    )
end

function translate(x::Number, y::Number, z::Number)::Mat4x4
    return Mat4x4(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        x, y, z, 1.0
    )
end

function scale(x::Number, y::Number, z::Number)::Mat4x4
    return Mat4x4(
        x, 0.0, 0.0, 0.0,
        0.0, y, 0.0, 0.0,
        0.0, 0.0, z, 0.0,
        0.0, 0.0, 0.0, 1.0
    )
end

function perspective(fovy::Number, aspect::Number, near::Number, far::Number)::Mat4x4
    f = cotd(fovy / 2.0)
    return Mat4x4(
        f / aspect, 0.0, 0.0, 0.0,
        0.0, f, 0.0, 0.0,
        0.0, 0.0, (far + near) / (near - far), -1.0,
        0.0, 0.0, (2.0 * far * near) / (near - far), 0.0
    )
end

const Framebuffer = Matrix{Vec4}

const DepthBuffer = Matrix{Float32}

# 此算法取自 https://codeplea.com/triangular-interpolation
# 这是我能找到的对重心坐标插值最简单的解释
function barycentric(v1::V, v2::V, v3::V, v::V)::Tuple{Float32,Float32,Float32} where {V<:AbstractVector{Float32}}
    denom = (v2[2] - v3[2]) * (v1[1] - v3[1]) + (v3[1] - v2[1]) * (v1[2] - v3[2])

    w1 = ((v2[2] - v3[2]) * (v[1] - v3[1]) + (v3[1] - v2[1]) * (v[2] - v3[2])) / denom
    w2 = ((v3[2] - v1[2]) * (v[1] - v3[1]) + (v1[1] - v3[1]) * (v[2] - v3[2])) / denom
    w3 = 1.0 - w1 - w2

    return (w1, w2, w3)
end

function interpolate3(p::Vec4, v1::T, v2::T, v3::T)::Union{T,Nothing} where {T}
    @assert hasfield(T, :position)
    @assert isa(v1.position, Vec4)

    p_xy = p[1:2]
    v1_xy = v1.position[1:2]
    v2_xy = v2.position[1:2]
    v3_xy = v3.position[1:2]

    w1, w2, w3 = barycentric(v1_xy, v2_xy, v3_xy, p_xy)
    if w1 < 0.0 || w2 < 0.0 || w3 < 0.0
        return nothing
    end

    ret = T()
    setfield!(ret, :position, p)
    for field in fieldnames(T)
        if field == :position
            continue
        end

        v1_field = getfield(v1, field)
        v2_field = getfield(v2, field)
        v3_field = getfield(v3, field)
        setfield!(ret, field, w1 * v1_field + w2 * v2_field + w3 * v3_field)
    end
    return ret
end

function render(
    width,
    height,
    depth_test::Bool,
    clear_color::Vec4,
    vertices::V,
    vertex_shader::VS,
    fragment_shader::FS,
)::Framebuffer where {V, VS <: Function, FS <: Function}
    @assert width > 0 && height > 0
    @assert length(vertices) % 3 == 0

    # fill framebuffer with clear color
    framebuffer = fill(clear_color, (height, width))
    depthbuffer::Union{DepthBuffer,Nothing} = nothing
    if depth_test
        depthbuffer = fill(floatmax(Float32), (height, width))
    end

    vs_outputs = pmap(vertex_shader, vertices)
    @threads for vs_output in vs_outputs
        t = vs_output.position[4]
        vs_output.position = vs_output.position / t
    end

    for i in 1:3:length(vs_outputs)
        v1 = vs_outputs[i]
        v2 = vs_outputs[i+1]
        v3 = vs_outputs[i+2]

        v1_pos = v1.position::Vec4
        v2_pos = v2.position::Vec4
        v3_pos = v3.position::Vec4
    
        # calculate bounding box
        min_x = min(v1_pos[1], v2_pos[1], v3_pos[1])
        max_x = max(v1_pos[1], v2_pos[1], v3_pos[1])
        min_y = min(v1_pos[2], v2_pos[2], v3_pos[2])
        max_y = max(v1_pos[2], v2_pos[2], v3_pos[2])
    
        # convert to pixel coordinate
        min_x_pixel = round(Int, (min_x + 1.0) * width / 2.0)::Int
        max_x_pixel = round(Int, (max_x + 1.0) * width / 2.0)::Int
        min_y_pixel = round(Int, (min_y + 1.0) * height / 2.0)::Int
        max_y_pixel = round(Int, (max_y + 1.0) * height / 2.0)::Int
    
        # ensure the bounding box is inside the framebuffer
        min_x_pixel = max(min_x_pixel, 1)
        max_x_pixel = min(max_x_pixel, width)
        min_y_pixel = max(min_y_pixel, 1)
        max_y_pixel = min(max_y_pixel, height)
    
        # rasterization
        for y_pixel in min_y_pixel:max_y_pixel
            @threads for x_pixel in min_x_pixel:max_x_pixel
                x = 2.0 * x_pixel / width - 1.0
                y = 2.0 * y_pixel / height - 1.0
                p = Vec4(x, y, 0.0, 1.0)
    
                # interpolate
                v = interpolate3(p, v1, v2, v3)
                if v === nothing
                    continue
                end
    
                # depth test
                if depth_test
                    if v.position[3] > depthbuffer[y_pixel, x_pixel]
                        continue
                    end
                    depthbuffer[y_pixel, x_pixel] = v.position[3]
                end
    
                # fragment shader
                color = fragment_shader(v)
    
                # write to framebuffer
                framebuffer[y_pixel, x_pixel] = color
            end
        end
    end

    return framebuffer
end

mutable struct Vertex
    position::Vec4
    color::Vec4

    Vertex() = new()
    Vertex(position::Vec4, color::Vec4) = new(position, color)
end

function vertex_shader(vertex::Vertex)::Vertex
    return vertex
end

function fragment_shader(vertex::Vertex)::Vec4
    return vertex.color
end

function packed2planar(packed::Matrix{Vec4})::Array{Float32,3}
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

function test()
    fb = render(
        600,
        600,
        true,
        Vec4(0.0, 0.0, 0.0, 1.0),
        [
            Vertex(Vec4(-1.0, -1.0, 0.0, 1.0), Vec4(1.0, 0.0, 0.0, 1.0)),
            Vertex(Vec4(1.0, -1.0, 0.0, 1.0), Vec4(0.0, 1.0, 0.0, 1.0)),
            Vertex(Vec4(0.0, 1.0, 0.0, 1.0), Vec4(0.0, 0.0, 1.0, 1.0)),
        ],
        vertex_shader,
        fragment_shader,
    )

    imshow(packed2planar(fb))
end

using BenchmarkTools
using InteractiveUtils

function bench()
    @btime render(
        600,
        600,
        true,
        Vec4(0.0, 0.0, 0.0, 1.0),
        [
            Vertex(Vec4(-1.0, -1.0, 0.0, 1.0), Vec4(1.0, 0.0, 0.0, 1.0)),
            Vertex(Vec4(1.0, -1.0, 0.0, 1.0), Vec4(0.0, 1.0, 0.0, 1.0)),
            Vertex(Vec4(0.0, 1.0, 0.0, 1.0), Vec4(0.0, 0.0, 1.0, 1.0)),
        ],
        vertex_shader,
        fragment_shader,
    )
end

end # module Softpipe

Softpipe.test()
