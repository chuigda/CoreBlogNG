!!meta-define:ident:10-minutes-computer-graphics-2
!!meta-define:title:十分钟计算机图形学 II - GPU 与图形 API
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-07-29T15:05:12+08:00
!!meta-define:tags:图形学,GPU,OpenGL,Vulkan,Julia
!!meta-define:brief:七通设计算机图形学与 Vk 入门专用教材，而这是续集。你还在等什么，<del>赶紧拨打热线电话订购吧！</del>

在 [上一章](/#/blog/1690381815-10-minutes-computer-graphics) 中，我们实现了一个非常简单的软件渲染器。管中窥豹，可见一斑，我们已经大致理解了（至少是传统的、基于光栅化方法的）渲染器是如何工作的。只不过目前所有的工作还都是在 CPU 上进行的。

## 图形处理器 GPU

在上一章的代码中，我们可以注意到，有这么几个 `for` 循环：

- 对每个顶点运行顶点着色器，然后进行正规化：

```julia
    vs_outputs = map(vertex_shader, vertices)
    for i in 1:vertex_count
        vs_outputs[i].position /= vs_outputs[i].position.w
    end
```

- 对每个像素计算重心坐标、进行插值，然后运行片元着色器输出颜色：

```julia
        for y_pix in min_y_pix:max_y_pix
            for x_pix in min_x_pix:max_x_pix
                x = 2.0 * x_pix / width - 1.0
                y = 2.0 * y_pix / height - 1.0

                fragment = interpolate3(Vec2(x, y), v1, v2, v3)
                if isnothing(fragment)
                    continue
                end

                color = fragment_shader(fragment)
                framebuffer[y_pix, x_pix] = color
            end
        end
```

稍微总结一下，我们可以得出这种 `for` 循环的特点：
- 需要循环的次数非常多，比如说，要填充一个包围盒为 1920x1080 的三角形，我们需要循环 2073600 次；
- 每次循环需要的数据非常少，比如我们上一章用到的两个着色器就只用到了顶点的坐标和颜色
- 每次循环执行的任务规模有限
- 两次循环之间没有什么依赖关系，可以*各算各的*，也就是说，**我们可以并行地进行这些循环**

而 CPU 是为*少量*的*大型*任务设计的，虽然 CPU 也可以利用多线程和 `SIMD` 等方式来加速处理，但面对浩如烟海的像素数量，CPU 也力不从心。这也就催生了专用的**图形处理器**，也就是 **GPU**。

## GPU 的特性

GPU 内部有大量的处理单元，每个处理单元都能相对独立地处理较为轻型的任务。这就使得 GPU 在并行处理方面具有很大的优势，并且刚好符合了上面提到的 `for` 循环的需求。不过，要妥善地利用 GPU 的能力，还是需要一些技巧的：
- GPU 单个处理单元的处理能力并不强，至少不像 CPU 那样强
- 如果要让多个 GPU 处理单元处理一组相互关联的任务，这些单元之间的通信会成为瓶颈
- CPU 和 GPU 之间传输数据需要通过 PCI-E 总线。总线的吞吐量很大，但也并非全无代价，并且总线传输的延迟很高

前两项优化的责任主要在程序员，例如程序员应该思考如何写出高性能的着色器代码，如何将任务分配给 GPU 处理单元等等。而最后一项优化则需要**图形 API** 予以配合。一般而言，在 CPU 和 GPU 之间高效地通信，需要：
- 尽可能少地发起传输
- 一次性传输尽可能多的数据
- 如果需要让 GPU 生成数据，则尽可能“本地生产、本地消费”

图形 API 的设计会以各种方式影响这些优化的可能性，我们马上会看到这一点。

## 早期图形 API —— 以 OpenGL 1.0 为例

在上一章中我们略微窥探了 OpenGL 1.0 的 API：

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

这种每次调用函数提交一点数据的方式称为 **立即模式（immediate mode）**。显然，我们很快就能发现这种 API 的另一个局限性：我们每次调用 `glColor3f` / `glVertex2f`，相当于只向 GPU 提交了几个字节的数据。而如果每次都要走 PCI-E 总线通信，最终的结果可能就是 GPU 绘图的时间只有一丁点，而传输数据的时间却占了大头。

这显然是不合理的，事实上图形驱动程序会在内部进行一些优化，例如将许多调用缓存起来，然后一次性传输。但驱动程序毕竟不可能知道用户程序到底在做什么，只能基于一些假设进行优化，而这些假设并不总是正确的。

## OpenGL 的斗争之路

### 顶点数组

要一次性提交尽量多的数据，最容易想到的方式就是使用数组。OpenGL 首先引入的东西就是**顶点数组（vertex array）**：

```c
float positionArray[] = {
    -1.0f, -1.0f,
    1.0f, -1.0f,
    0.0f, 1.0f
};

float colorArray = {
    1.0f, 0.0f, 0.0f,
    0.0f, 1.0f, 0.0f,
    0.0f, 0.0f, 1.0f
};

// glVertex“2f” 是一次上传 2 个 GLfloat，而 glVertex“Pointer” 就是一次性上传一个 GLfloat 数组
glVertexPointer(2, GL_FLOAT, 0, positionArray);
// glColor“Pointer” 同理
glColorPointer(3, GL_FLOAT, 0, colorArray);

glDrawArrays(GL_TRIANGLES, 0, 3);
```

有了 `glXxxPointer` 这样的 API，就能一次性提交一组数据了。

### 顶点缓冲对象

有顶点数组还不够。在很多场景下，一个物体的顶点数据是不会变的，但用 `glXxxPointer` 这样的 API，我们还是需要每次绘制物体都提交一遍顶点数据。一个很直观的思路就是增加这样一个 API：它能够让我们把某一段数据直接上传到 GPU 上，让 GPU 返回给我们一个*句柄*，之后在绘制的时候只要提交这个句柄给 GPU，GPU 就会自动调动相应的数据。没错，这就是**顶点缓冲对象（Vertex Buffer Object, VBO）**：

```c
// 初始化阶段
int bufferId;
glGenBuffers(1, &bufferId); // 在 GPU 那边创建一个缓冲区，把句柄存储到 bufferId 中
// ...

// 数据上传
glBindBuffer(GL_ARRAY_BUFFER, bufferId); // 选择要操作的缓冲区
glBufferData(GL_ARRAY_BUFFER, sizeof(positionArray), positionArray, GL_STATIC_DRAW); // 上传数据
// ...

// 绘制阶段
glBindBuffer(GL_ARRAY_BUFFER, bufferId); // 选择要操作的缓冲区
glVertexPointer(2, GL_FLOAT, 0, 0); // 给原先传指针的参数传 0 （空指针），表示从缓冲区中读取数据
glDrawArrays(GL_TRIANGLES, 0, 3); // 直接调用之前存储在 GPU 上的数据进行绘制
```

### 顶点数组对象

有了 VBO，我们就可以把顶点数据存储在 GPU 上了。但是，我们还是需要每次调用 `glXxxPointer` 来告诉 GPU 顶点数据的格式。这样的话，我们就需要在绘制的时候，每次都要调用一次 `glXxxPointer`。如果绘制一个物体涉及很多组数据（顶点位置、颜色、纹理坐标、法线等），这样的调用就会很多，而这也会成为问题。解决的方法就是让一个东西来管理多个 VBO，这就是**顶点数组对象（Vertex Array Object, VAO）**：

```c
// 初始化阶段
int vaoId;
glGenVertexArrays(1, &vaoId); // 在 GPU 那边创建一个 VAO，把句柄存储到 vaoId 中

// 数据上传
glBindVertexArray(vaoId); // 选择要操作的 VAO
// 之后的所有操作都会被记录到这个 VAO 中
// ...

// 绘制阶段
glBindVertexArray(vaoId); // 选择要操作的 VAO
glDrawArrays(GL_TRIANGLES, 0, 3); // 直接调用之前存储在 GPU 上的数据进行绘制
```

### 实例化渲染

目前为止，渲染*一个*物体的问题我们已经解决的差不多了。但如果是多个物体怎么办？

不同的物体可能共享同一组顶点数据，但它们的位置、姿态（旋转）、缩放是不同的。在 OpenGL 的固定功能管线中，这些信息是通过一系列 API 调用来传送的：

```c
glMatrixMode(GL_MODELVIEW); // 选择模型视图矩阵
glLoadIdentity(); // 重置矩阵为单位矩阵
glTranslatef(1.0f, 0.0f, 0.0f); // 平移
// 其他
```

而在可编程管线的时代，这些变换通常会由着色器代码来进行处理：

```glsl
in vec3 position;

uniform mat4 modelView;
uniform mat4 projection;

void main() {
    gl_Position = projection * modelView * vec4(position, 1.0);
}
```

矩阵数据通过 `uniform` 传送：

```c
// 初始化阶段，从着色器取得 uniform 变量的位置
int modelViewLoc = glGetUniformLocation(shaderProgram, "modelView");

// 绘制阶段，传送数据
glUniformMatrix4fv(modelViewLoc, 1, GL_FALSE, modelViewMatrix);
```

如果绘制很多同样的物体，我们就需要重复地调用 `glUniformMatrix4fv`，这样的调用也会成为瓶颈。解决方法就是**实例化渲染（instanced rendering）**，也就是一次性提交多个矩阵：

```glsl
in vec3 position;

uniform mat4 modelView[100]; // 一次性可以提交至多 100 个矩阵
uniform mat4 projection; // projection 一般是不用变的，可以不用实例化渲染

void main() {
    gl_Position = projection * modelView[gl_InstanceID] * vec4(position, 1.0);
}
```

```c
// 一次性提交 100 个矩阵
glUniformMatrix4fv(modelViewLoc, 100, GL_FALSE, modelViewMatrices);
```

### 帧缓冲对象和渲染到纹理

有的时候，我们需要动态地生成一些纹理，然后再将这些纹理用于渲染。在 OpenGL 3.0 之前，我们需要在 OpenGL 把内容输出之后，从帧缓冲区中读取数据，然后再作为纹理上传给 GPU。这样做非常低效，因为我们需要在 CPU 和 GPU 之间来回传输数据。而帧缓冲对象（Frame Buffer Object, FBO）则可以让我们在 GPU 上直接生成纹理，“本地生产，本地消费”，这种方式称为**渲染到纹理（Render To Texture）**：

```c
// 初始化阶段
int fboId;
glGenFramebuffers(1, &fboId); // 在 GPU 那边创建一个 FBO，把句柄存储到 fboId 中
int textureId;
glGenTextures(1, &textureId); // 在 GPU 那边创建一个纹理，把句柄存储到 textureId 中
// 将纹理和 FBO 关联起来
glBindFramebuffer(GL_FRAMEBUFFER, fboId); // 选择要操作的 FBO
glBindTexture(GL_TEXTURE_2D, textureId); // 选择要操作的纹理
glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, 0); // 生成纹理
glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, textureId, 0); // 把纹理附加到 FBO 上
// ...

// 纹理生成阶段
glBindFramebuffer(GL_FRAMEBUFFER, fboId); // 选择要操作的 FBO
// 之后的所有操作都会被记录到这个 FBO 中
// ...
glBindFramebuffer(GL_FRAMEBUFFER, defaultFramebufferId); // 切换回默认的 FBO

// 绘制阶段
glBindTexture(GL_TEXTURE_2D, textureId); // 选择要操作的纹理
// 之后就能用这个纹理进行绘制了
```

## Vulkan 的诞生

“老骥伏枥，志在千里，烈士暮年，壮心不已。”然而，不幸的是，尽管 OpenGL 在不断引入新的特性，但其发展仍然始终受到其早期设计的限制：
- OpenGL 的 API 设计中隐含了一个全局的状态，也就是*OpenGL 上下文*。这个状态的存在使得诸如 RAII这样的编程范式无法运用。此外，OpenGL 上下文的存在也使得在多线程环境中使用 OpenGL 困难重重。
- 尽管已经把尽可能多的东西做成了缓冲（buffer），OpenGL 仍然需要大量的 API 调用来提交数据 —— 特别是如果没法进行实例化渲染的话
- 渲染管线中的很多部分都有一些“默认值”，时常给程序员带来困惑

因此，新近的 API 基本都在围绕着解决这些问题来设计，设计思想可谓是殊途同归：
- 状态被显式地保存在某个对象中
- 将绘制指令也做成某种缓冲，一次性提交，减少 API 调用
- 几乎不留任何默认值，要求用户指定所有的细节

Vulkan 就是这样的一个 API，由 OpenGL *原 班 人 马* Khronos Group 开发。

## 结论

在本文中，我们讨论了 GPU 的特性，以及图形 API 为适应 GPU 特性的演化过程。这两篇文章的深度和广度都非常有限，但希望能够让读者对图形 API 的发展有一个大致的了解。

如果想要学习 Vulkan，可以查看：
- [Vulkan Tutorial](https://vulkan-tutorial.com/)
- [Vulkan Tutorial - Rust 版本，使用 Vulkanalia 实现](https://kylemayes.github.io/vulkanalia)
- [Vulkan Tutorial 的中文翻译](https://github.com/fangcun010/VulkanTutorialCN)
- [Vulkan Tutorial - Rust 版本的中文翻译](https://vk.7dg.tech)，由本文作者带队翻译！强烈<del>广告</del>安利！

当然，Vulkan API 因其学习曲线，并不适合所有人，尤其不适合初学者。如果想要学习 OpenGL，可以查看：
- [LearnOpenGL](https://learnopengl.com/)
- [LearnOpenGL CN](https://learnopengl-cn.github.io/)
- [OpenGL Tutorial](http://www.opengl-tutorial.org/)
- [OpenGL Tutorial - 中文翻译](http://www.opengl-tutorial.org/cn/beginners-tutorials/tutorial-1-opening-a-window/)

## 参考文献
- [OpenGL Super Bible 4th Edition](https://theswissbay.ch/pdf/Gentoomen%20Library/Game%20Development/Programming/OpenGL%20SuperBible%204th%20Edition.pdf)
- [LearnOpenGL](https://learnopengl.com/)
- [Vulkan Tutorial - Introduction](https://vulkan-tutorial.com/Introduction)
- [WebGPU specification](https://www.w3.org/TR/webgpu/)
