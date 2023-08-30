!!meta-define:ident:c-interface-design
!!meta-define:title:C 语言 API 设计
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-08-30T13:58:30+08:00
!!meta-define:tags:C 语言
!!meta-define:brief:本文围绕若干实际项目中的案例，介绍了几种 C API 的设计思路，并比较了它们之间的差异。

要将自己用 C 语言编写的代码封装成库，以供他人使用，就需要设计并实现一系列的 API，包括数据类型、函数和宏等。本文围绕若干实际项目中的案例，介绍了几种设计 C API 的方式，并比较了它们之间的差异。本文也会在涉及一些 C 语言特性时给出必要的说明。

## 数据类型

库通常都需要定义一些数据类型，以便在函数之间传递数据。而一旦涉及到库的设计，在 API 中定义类型就有了多种选择。因此，我们的讨论也从数据类型出发。

在 C 语言中，持有一个指向结构体的指针并不需要该结构体的完整定义。因此，我们可以进行如下操作：

```c
// QuickJS
typedef struct JSRuntime JSRuntime;

JSRuntime *JS_NewRuntime(void);
void JS_SetRuntimeInfo(JSRuntime *rt, const char *info);
void JS_SetMemoryLimit(JSRuntime *rt, size_t limit);
// ...
```
QuickJS 使用*不透明*的结构体定义：用户只能通过指针和特定的函数来操作 `JSRuntime` 结构体，而不能直接访问它的成员。这样做的好处在于用户完全不知道、也不需要知道 `JSRuntime` 内部的细节。这样就能避免用户直接操作结构体成员，破坏 QuickJS 的内部状态；此外 QuickJS 也可以在不破坏 API 的情况下修改结构体的定义，而用户的代码不需要做任何修改。

但这样做也有缺点 —— 主要是性能方面。要创建一个 `JSRuntime` 对象，几乎肯定免不了要使用*堆分配*；并且，通过指针和（非内联的）函数调用来操作结构体肯定会有性能损失。如果用这种方式来操作大量的小型对象，那么性能损失就会变得显著。

库也可以选择把结构体的定义开放给用户，然后通过某种方式“教导”用户不要直接操作结构体成员：

```c
// TinyAES
struct AES_ctx
{
  uint8_t RoundKey[AES_keyExpSize];
#if (defined(CBC) && (CBC == 1)) || (defined(CTR) && (CTR == 1))
  uint8_t Iv[AES_BLOCKLEN];
#endif
};

void AES_init_ctx(struct AES_ctx* ctx, const uint8_t* key);
void AES_init_ctx_iv(struct AES_ctx* ctx, const uint8_t* key, const uint8_t* iv);
void AES_ctx_set_iv(struct AES_ctx* ctx, const uint8_t* iv);
```

这里的 `AES_ctx` 的成员仍不应被手动操作。但因为用户能够获取 `AES_ctx` 的完整定义，用户可以直接在*栈*上创建一个 `AES_ctx`，而无须使用堆分配：

```c
struct AES_ctx ctx;
AES_init_ctx(&ctx, "Zdravstvuyte,mir");
```

此外，对于一些简单结构，也可以直接把操纵结构体成员的权限交给用户：

```c
// 某专有软件
typedef struct {
    size_t size;
    uint8_t *data;
} SizedBuffer;
```

```c
// QuickJS
typedef union JSValueUnion {
    int32_t int32;
    double float64;
    void *ptr;
} JSValueUnion;

typedef struct JSValue {
    JSValueUnion u;
    int64_t tag;
} JSValue;
```

## 函数之外

除了提供对用户“不透明”的函数，库还可以提供一些“透明”的函数，这样客户端代码就可以内联调用这些函数，从而避免了函数调用的开销：

```c
// QuickJS
static js_force_inline JSValue JS_NewBool(JSContext *ctx, JS_BOOL val)
{
    return JS_MKVAL(JS_TAG_BOOL, (val != 0));
}
```

或者，库还可以选择提供宏：

```c
// QuickJS
#define JS_VALUE_GET_TAG(v) (int)((v) >> 32)
#define JS_VALUE_GET_INT(v) (int)(v)
#define JS_VALUE_GET_BOOL(v) (int)(v)
#define JS_VALUE_GET_PTR(v) (void *)(intptr_t)(v)

// ...
```

## 多返回值

C 语言本身并不支持多返回值，但可以通过指针参数来模拟多返回值：

```c
// Windows API
BOOL GetMessage(
    LPMSG lpMsg,
    HWND  hWnd,
    UINT  wMsgFilterMin,
    UINT  wMsgFilterMax
);
```

这里，`GetMessage` 返回了两个值 —— 一个通过返回的 `BOOL`，另一个通过输出参数 `lpMsg`：如果消息循环中有消息，那么 `GetMessage` 会将消息的内容写入 `lpMsg`，并返回 `TRUE`；否则，`GetMessage` 会返回 `FALSE`。

## 错误处理

对于不同的库，错误处理的方式也不尽相同。但总的来说，有以下方略可以遵循：

对于返回指针的函数，失败时可以返回空指针：

```c
// POSIX
void *dlopen(const char *filename, int flag);

// Windows API
HMODULE LoadLibraryA(LPCSTR lpszLibFileName);
```

类似地，对于返回文件描述符/某种句柄的函数，失败时可以返回对于该返回值类型而言无效的值：

```c
// POSIX
int open(const char *pathname, int flags); // 返回文件描述符，失败时返回 -1

// Windows API
ATOM RegisterClassA(const WNDCLASSA *lpWndClass); // 返回 ATOM，失败时返回 0
```

其他情况下，可以让 API 返回一个错误代码：

```c
// POSIX
int pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                   void *(*start_routine) (void *), void *arg);

// Windows API
BOOL SetConsoleCursorPosition(HANDLE hConsoleOutput, COORD dwCursorPosition);
```

除了让每步操作返回某种错误代码之外，还可以提供一些“查询”函数，用来获取错误信息：

```c
// POSIX
// 严格意义上来说 errno 不是函数，也不是常规的变量
if (errno == EACCES) {
    // ...
}

// Windows API
if (GetLastError() == ERROR_ACCESS_DENIED) {
    // ...
}

// OpenGL
GLenum err = glGetError();
if (err == GL_INVALID_ENUM) {
    // ...
}
```

## extern "C"

作为计算机科学的基石，跨语言调用领域的事实标准，C 语言编写的代码通常都会被其他语言调用。最常见的情形之一是，C++ 会直接引入 C 的头文件，然后调用其中的函数。这时，C 语言的 API 就需要使用 `extern "C"` 来声明：

```c
#ifdef __cplusplus
extern "C" {
#endif

// ...

#ifdef __cplusplus
} // extern "C"
#endif
```

这是因为 C 和 C++ 使用不同的调用协定，例如 C++ 的函数调用会在编译时进行*名称修饰*，而 C 的函数调用则不会。如果不明确告诉编译器“这些是 C 函数”，编译器就会按照 C++ 的调用协定去调用这些函数，引起各种各样的问题。

## FFI

除了 C++，其他语言也可以通过*外部函数接口*（Foreign Function Interface，FFI）来调用 C 语言的函数，这些 FFI 方式基本都是 `dlfcn` 的套壳，以 Julia 为例：

```julia
using Libdl: dlopen, dlsym, dlclose

lib = dlopen("libfoo.so", RTLD_NOW)
foo = dlsym(lib, "foo")

@ccall $foo()::Cvoid

dlclose(lib)
```

其实就是

```c
#include <dlfcn.h>

void *lib = dlopen("libfoo.so", RTLD_NOW);
void (*foo)(void) = dlsym(lib, "foo");

foo();

dlclose(lib);
```

此时，我们之前的所有抉择都会对 FFI 调用产生影响：

### 透明结构体 vs 不透明结构体

不透明结构体可以很简单地在 FFI 调用中使用，只需要将结构体指针视为一个 `void*` 即可：

```julia
# 以 QuickJS JS_Runtime 为例
const LPVOID = Ptr{Cvoid}
js_runtime = @ccall $JS_NewRuntime()::LPVOID
```

而透明结构体就要麻烦一些 —— 调用方必须能构造出尺寸和布局完全一致的内存，用来存放结构体的成员：

```julia
struct SizedBuffer
    size::Csize_t
    data::Ptr{Cuint8}
end
```

而有的时候，结构体的具体结构取决于库的实际构建配置，这就使得 FFI 调用方必须知道库的构建配置，才能构造出正确的结构体。这就使得库的使用变得复杂，而且容易出错。例如考虑 MbedTLS 中的 `mbedtls_rsa_context`：

```c
typedef struct mbedtls_rsa_context
{
    int MBEDTLS_PRIVATE(ver);                    
    size_t MBEDTLS_PRIVATE(len);                 
    mbedtls_mpi MBEDTLS_PRIVATE(N);              
    mbedtls_mpi MBEDTLS_PRIVATE(E);              
    mbedtls_mpi MBEDTLS_PRIVATE(D);              
    mbedtls_mpi MBEDTLS_PRIVATE(P);              
    mbedtls_mpi MBEDTLS_PRIVATE(Q);              
    mbedtls_mpi MBEDTLS_PRIVATE(DP);             
    mbedtls_mpi MBEDTLS_PRIVATE(DQ);             
    mbedtls_mpi MBEDTLS_PRIVATE(QP);             
    mbedtls_mpi MBEDTLS_PRIVATE(RN);             
    mbedtls_mpi MBEDTLS_PRIVATE(RP);             
    mbedtls_mpi MBEDTLS_PRIVATE(RQ);             
    mbedtls_mpi MBEDTLS_PRIVATE(Vi);             
    mbedtls_mpi MBEDTLS_PRIVATE(Vf);             
    int MBEDTLS_PRIVATE(padding);                
    int MBEDTLS_PRIVATE(hash_id);                
#if defined(MBEDTLS_THREADING_C)
    /* Invariant: the mutex is initialized iff ver != 0. */
    mbedtls_threading_mutex_t MBEDTLS_PRIVATE(mutex);    
#endif
}
mbedtls_rsa_context;
```

有一种投机取巧的办法来缓解这一问题：只要开一个足够大的 buffer，那么 `mbedtls_rsa_*` 调用就肯定不会越界，事实上 MbedTLS.jl 也确实是这么做的：

```julia
mutable struct RSA
    data::Ptr{mbedtls_rsa_context}

    function RSA(padding=MBEDTLS_RSA_PKCS_V21, hash_id=MD_MD5)
        ctx = new()
        ctx.data = Libc.malloc(1000) # 直接开一个足够大的 buffer
        ccall((:mbedtls_rsa_init, libmbedcrypto), Cvoid,
            (Ptr{Cvoid}, Cint, Cint),
            ctx.data, padding, hash_id)
        finalizer(ctx->begin
            ccall((:mbedtls_rsa_free, libmbedcrypto), Cvoid, (Ptr{Cvoid},), ctx.data)
            Libc.free(ctx.data)
        end, ctx)
        ctx
    end
end
```

### 普通函数 vs 内联函数/宏

普通函数能直接被 `dlsym` 加载，而内联函数和宏则不能。这就使得内联函数和宏不能被 FFI 调用方直接使用。必要的情况下需要提供一个普通函数，用来包装内联函数或宏：

```c
// QuickJS
static js_force_inline JSValue JS_NewBool(JSContext *ctx, JS_BOOL val)
{
    return JS_MKVAL(JS_TAG_BOOL, (val != 0));
}

JSValue JS_NewBool_wrapper(JSContext *ctx, JS_BOOL val)
{
    return JS_NewBool(ctx, val);
}
```

或者，考虑到 JSValue 的内容是已知的，并且不太可能改变，我们也可以直接在 Julia 一侧实现 `JS_NewBool`：

```julia
struct JSValue
    u::JSValueUnion
    tag::Cint64
end

function JS_NewBool(ctx::Ptr{JSContext}, val::Cint)
    # ...
end
```
