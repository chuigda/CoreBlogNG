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

## extern "C"

作为计算机科学的基石，跨语言调用领域的事实标准，C 语言编写的代码通常都会被其他语言调用。

> 未完待续，咕咕咕