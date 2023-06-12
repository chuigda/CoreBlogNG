!!meta-define:ident:pbr-shading
!!meta-define:title:PBR 初步探索
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-06-12T21:30:00+08:00
!!meta-define:tags:CG
!!meta-define:brief:哈哈，终于不用忍受画什么都像石膏和塑料的痛苦了

<div class="img-container">
<img src="/extra/blog-images/pbr-render-output.png" alt="PBR 渲染输出" width="401" height="320" />
</div>

在完成 [WGC0310](https://github.com/chuigda/Project-WG) 的初代版本 (0.1.0 ~ 0.3.4) 和 
[Lite版本](https://github.com/chuigda/Project-WG-Lite) 之后，经过个人的评估，
传统的冯氏光照模型既不符合时代潮流、无法与现代工具兼容，也无法满足 WGC0310
后续的升级需求。那么，既然 WGC0310 的 0.4.0 版本已经切换到了 OpenGL 3.3 Core Profile，
可以使用着色器，那么不妨试试 PBR (Physics Based Rendering, 基于物理的渲染)。

## 理论

简单来说，当一束光线照射到一个不透明物体上时

* 一部分光线会被物体的表面直接反射，形成镜面反射 (Specular Reflection) 光
* 另一部分光线，取决于物体的材料
    * 如果物体是金属，光线的能量会迅速地被金属中的电子吸收，然后被重新辐射出去 (左图)
    * 如果物体是非金属，光线会在物体内部发生多次反射，最终形成散射 (Diffuse) 光 (右图)
* 在上述过程中，出射光线的总能量不会超过入射光线的总能量

<div class="img-container">
<img src="/extra/blog-images/specular-and-diffuse.png" alt="镜面反射与散射" width="509" height="114" />
</div>

## PBR 与光栅化

<div class="img-container">
<img src="/extra/blog-images/who-cares-who-emits-the-light.png"
     alt="没人在乎光线是谁散射的"
     title="没人在乎光线是谁散射的"
     width="532" height="281"
/>
</div>

在上图中可以直观地看到，对于物体表面的每一个点，理论上来说，从某个角度观察时，这个点的颜色来源于两个方面：
* 这一点上的镜面反射光
* 来自其他点入射光的散射光

第二条乍看起来有些棘手，因为这需要把其他点的入射光线考虑在内。但实际上，这个模型可以被简化。
既然从这个点入射的光线会变成其他地方的散射光，而其他点入射的光线会变成这个点的漫反射光，
那么不如就*假设这个点的漫反射光就来自这个点的入射光*。这样一来，从某个角度观察到这个点的颜色
就只和**光源位置**、**观察者位置**，以及**这个点本身的参数**相关，这个计算过程就可以被装进 shader 了。

## 镜面反射光的计算

PBR 中的镜面反射光计算基于微平面模型 (Microfacet Model)。这个模型假设物体表面由许多微小的平面组成的，
每个微平面都有一个法向量。当从某一个角度观察这个物体时，只有朝向特定角度的微平面才会反射光线到观察者：

<div class="img-container">
<img src="/extra/blog-images/pbr-microfacet.png"
     alt="微平面模型"
     width="434"
     height="114"
/>
</div>

而在反射的过程中，微平面带来的凹凸也会遮挡一些反射光线：

<div class="img-container">
<img src="/extra/blog-images/pbr-microfacet-shadowing.png"
     alt="微平面遮挡"
     width="400"
     height="104"
/>
</div>

这些微平面非常非常多、非常非常细小，比屏幕上的一个像素还要小，因此不可能用通常的手段去渲染每一个微平面。
但是，如果我们知道了物体表面的法向量分布，那么就可以用统计的方法来估算出反射光线的分布。
**粗糙度** (Roughness) 就是用来描述这个法向量分布的参数，粗糙度越大，法向量分布越均匀，反射光线的分布越宽。

这样一来，某个点的镜面反射强度就可以归纳为：

```text
反射光强度 = 朝向观察者的微平面数量比例D * 没有被遮挡的微平面数量比例G * 反射率F
```

其中
* `D`（“法线分布函数”） 和 `G`（“几何函数”） 可以用统计的方法估算出来
* `F`（“菲涅耳方程”）是一个和入射角度相关的函数

## 漫反射光的计算

漫反射光的计算比较简单，只需要知道物体表面的法向量，以及光源的位置，就可以计算出这个点的漫反射强度。
朗伯定律 (Lambert's Cosine Law) 描述了漫反射光的强度和入射角度的关系：

```text
漫反射光强度 = 入射光强度 * cos(入射角)
```

和 PBR 中的镜面反射光一样，漫反射光的强度也会受到粗糙度的影响，粗糙度越大，漫反射光的强度越小。

## 组装

实际上，我也不完全理解 `D`, `G`, `F` 和 `Lambert` 具体公式的意义，但 *我可以照抄 learnopengl 的代码*：

### Vertex shader

```glsl
#version 330 core

attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uProjection;
uniform mat4 uModelView;

varying vec3 vFragPos;
varying vec3 vNormal;

void main() {
    vec4 temp = uModelView * vec4(aPosition, 1.0);

    gl_Position = uProjection * temp;
    vNormal = mat3(transpose(inverse(uModelView))) * aNormal;
    vFragPos = vec3(temp);
}
```

这里我把通常的 Model 和 View 两个矩阵合成了一个 `uModelView`，并且假设观察点总是在 `(0, 0, 0)` 处。

### Fragment shader

```glsl
#version 330 core

varying vec3 vFragPos;
varying vec3 vNormal;

const vec3 lightColor = vec3(300, 300, 300);
const vec3 lightPos[4] = vec3[4](
    vec3(-5.0, 5.0, 0.0),
    vec3(5.0, 5.0, 0.0),
    vec3(-5.0, -5.0, 0.0),
    vec3(5.0, -5.0, 0.0)
);
const vec3 albedo = vec3(0.5, 0.0, 0.0);
const float ao = 1.0;

uniform float uMetallic;
uniform float uRoughness;

const float PI = 3.14159265359;

// 光线衰减的计算
float calculateAttenuation(vec3 pos, vec3 lightPos);

// 菲涅耳方程
vec3 fresnelSchlick(float cosTheta, vec3 f0);

// 法线分布函数
float distributionGGX(vec3 normal, vec3 halfway, float roughness);

// 几何函数
float geometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness);

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vFragPos);

    vec3 f0 = mix(vec3(0.04), albedo, uMetallic);

    vec3 lo = vec3(0.0);

    for (int i = 0; i < 4; i++) {
        vec3 lightDir = normalize(lightPos[i] - vFragPos);
        vec3 halfwayDir = normalize(lightDir + viewDir);

        float attenuation = calculateAttenuation(vFragPos, lightPos[i]);
        vec3 radiance = lightColor * attenuation;

        float NDF = distributionGGX(normal, halfwayDir, uRoughness);
        float G = geometrySmith(normal, viewDir, lightDir, uRoughness);
        vec3 F = fresnelSchlick(clamp(dot(halfwayDir, viewDir), 0.0, 1.0), f0);

        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - uMetallic;

        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.0001;
        vec3 specular = numerator / denominator;

        float NdotL = max(dot(normal, lightDir), 0.0);
        lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }

    vec3 ambient = vec3(0.03) * albedo * ao;
    vec3 color = ambient + lo;

    // 整个 PBR 的计算是在 HDR 空间中进行的
    // 进行一轮 gamma 校正，然后再转换到 LDR 空间
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}

float calculateAttenuation(vec3 pos, vec3 lightPos) {
    float distance = length(lightPos - pos);
    return 1.0 / (distance * distance);
}

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
    return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

float distributionGGX(vec3 normal, vec3 halfway, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(normal, halfway), 0.0);
    float NdotH2 = NdotH * NdotH;

    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}

float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;

    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}

float geometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float ggx2 = geometrySchlickGGX(NdotV, roughness);
    float ggx1 = geometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}
```

### Julia code

```julia
for roughness in 0.0:0.1:1.0
    for metallic in 0.0:0.1:1.0
        x = roughness * 2.0 - 1.0
        y = 1.0 - metallic * 2.0

        model_view = TyCG.translate(0, 0, -3) *
            TyCG.rotate_y(rotation) *
            TyCG.translate(x, y, 0) *
            TyCG.scale(0.09, 0.09, 0.09)
        TyCG.uniform_matrix4fv(cg, shader_program, "uModelView", model_view)
        TyCG.uniform_1f(cg, shader_program, "uMetallic", metallic)
        TyCG.uniform_1f(cg, shader_program, "uRoughness", roughness)
        TyCG.draw(cg, vbo)
    end
end
```

最终输出的效果就是篇首的那张图。

## 参考文献

- [LearnOpenGL - PBR - Theory](https://learnopengl.com/PBR/Theory)
- [LearnOpenGL - PBR - Lighting](https://learnopengl.com/PBR/Lighting)
- [Background: Physics and Math of Shading](https://blog.selfshadow.com/publications/s2013-shading-course/hoffman/s2013_pbs_physics_math_notes.pdf)
