!!meta-define:ident:basic-polymorphic-typechecking
!!meta-define:title:Basic polymorphic typechecking
!!meta-define:author:Luca Cardelli
!!meta-define:time:1984-01-01T00:00:00+08:00
!!meta-define:tags:编译器,Java,程序设计语言理论,类型系统
!!meta-define:brief:Chuigda 对 1984 年 Luca Cardelli 论文 Basic polymorphic typechecking 的翻译，并且使用 Java 重写了论文中的例子。

## 0. 前言

本文是对 1984 年 Luca Cardelli 论文 [Basic polymorphic typechecking](http://lucacardelli.name/Papers/BasicTypechecking%20(TR%201984).pdf) 的翻译，并且使用 Java 重写了论文中的例子，避免 ML 的语法对读者造成困扰，以及找不到好的 ML 实现对读者造成困扰。

记仇时刻：

<div class="img-container">
<img src="/extra/blog-images/chuigda-doesnt-learn-jvav.jpg" alt="Chuigda 不学 Jvav" width="540" height="169"/>
</div>

## 1. 介绍

多态类型检查（Polymorphic typechecking）的基础是 Hindley 所设计的类型系统 [Hindley 69]，并在之后被 Milner 再次发现并进行了扩展 [Milner 78]。这个算法在 ML 语言 [Gordon 79, Milner 84] 中被实现。这种类型系统具有和 Algol 68 一样的编译期检查、强类型和高阶函数，但因为它允许多态 —— 也就是定义在多种类型的参数上具有统一行为的函数，所以它更加灵活。

Milner 的多态类型检查算法是非常成功的：它健全、高效、功能丰富且灵活。它也可以被用于在没有类型信息（untyped）或者只有部分类型信息（partially typed）的程序中推导出类型。

然而，多态类型检查只在一小部分人群中得到了使用。目前的出版物中只有 [Milner 78] 中存在对这个算法的描述，并且其行文相对专业，更多地面向理论背景。

为了让这个算法能够为更多的人所接受，我们现在提供了一个 ML 实现，这个实现非常类似于 LCF，Hope 和 ML [Gordon 79, Burstall 80, Milner 84] 中所使用的实现。尽管有时候人们会为了逻辑清晰而牺牲性能，但这个实现还是相对高效的，并且可以被实际地用于大型程序的类型检查。

本文中的 ML 实现只考虑了类型检查中最基本的情况，并且许多对常见编程语言结构的扩展都相当明显。目前已知的非平凡扩展（本文不会讨论）包括重载、抽象数据类型、异常处理、可更新的数据、带标签的 record（labelled record）以及 union 类型。许多其他的扩展仍然处于研究之中，并且人们普遍认为在类型检查的理论与实践中，重要的发现尚未浮出水面。

## 2. 一个简单的应用序（Applicative）语言

本文所使用的语言是一个简单的带有常量的类型化 lambda 演算（typed lambda calculus），这被认为是 ML 语言的核心。求值机制（call-by-name 或者 call-by-value）并不影响类型检查。

下面给出表达式的具体语法；相应的抽象语法在本文结尾处由程序中的 `Term` 类型给出（不含解析器与打印）。

```
Term ::= Identifier
       | 'if' Term 'then' Term 'else' Term
       | 'fun' Identifier '.' Term
       | Term Term
       | 'let' Declaration 'in' Term
       | '(' Term ')'

Declaration ::= Identifier '=' Term
              | Declaration 'and' Declaration
              | 'rec' Declaration
              | '(' Declaration ')'
```

只要在初始环境中包含一系列预定义的标识符，就可以想这个语言中引入新的数据类型。这样在扩展语言时就不需要修改语法以及类型检查算法。

例如，以下程序定义了一个阶乘函数，并且对 `0` 应用它

```ml
let rec factorial n =
    if zero n
    then succ 0
    else (times (pair n (factorial (pred n))))
in factorial 0
```

## 3. 类型

一个类型可以是一个用于表示任意类型的类型变量（type variable），如 α、β，也可以是一个类型运算符（type operator）。`int`（整数类型）和 `bool`（布尔类型）是无参（nullary）类型运算符。而 `→`（函数类型）和 `×`（积类型）这样的参数化（parametric）类型运算符则接受一个活多个类型作为参数。以上运算符最为一般化的形式是 `α → β`（任意函数的类型）和 `α × β`（任意序对的类型）。包含类型变量的类型被称为*多态（polymorphic）的*，而不含类型变量的类型被称为*单态（monomorphic）的*。常规的编程语言，例如 Pascal 和 Algol 68 等，其中的类型都是单态的。

如果同一个类型变量在表达式中出现了多次，那么这个表达式表示上下文依赖（contextual dependencies）。例如，表达式 `α → α` 表达了函数类型的定义域（domain）和值域（codomain）之间的上下文依赖。类型检查的过程包括匹配类型运算符和实例化类型变量。当实例化一个类型变量时，这个类型变量所在的其他位置必须被实例化为相同的类型。例如，对 `α → α` 合法的实例化可以是 `int → int`，`bool → bool`，`(β × ξ) → (β × ξ)`。上下文相关的实例化过程是通过 *unification* [Robinson 1] 来完成的，这也是多态类型检查的基础。当尝试匹配两种不同的类型运算符（例如 `int` 和 `bool`），或是尝试将类型变量实例化为一个包含它自身的项目（例如 `α` 和 `α → β`）时，unification 就会失败。后一种情况会在对自应用（self-application）表达式（例如 `fun x . (x x)`）进行类型检查时出现，因此自应用表达式是不合法的。

我们来看一个简单的类型检查的例子。恒等函数 `I = fun x . x` 具有类型 `α → α`，因为它将任何类型映射到它自身。在表达式 `(I 0)` 中，`0` 的类型（也就是 `int`）被匹配为 `I` 的定义域类型，于是在这个上下文中，`I` 的类型被特化为 `int → int`。而表达式 `(I 0)` 的类型为特化后的 `I` 的值域类型，也就是 `int`。

一般而言，表达式的类型是由一系列原语运算符的类型和与语言结构对应的类型结合规则确定的。最初的类型环境中可以为布尔、整数、序对和列表包含以下原语（`→` 是函数类型运算符，`list` 是列表类型运算符，`×` 是笛卡尔积）：

```
true, false  : bool
0, 1, ...    : int
succ, pred   : int → int
zero         : int → bool
pair         : α → β → (α × β)
fst          : (α × β) → α
snd          : (α × β) → β
nil          : α list
cons         : (α × α list) → α list
hd           : α list → α
tl           : α list → α list
null         : α list → bool
```

## 4. `length` 的类型

在描述类型检查算法之前，让我们先来探讨一下下面这个计算列表长度的简单递归程序的类型：

```ml
let rec length = 
    fun l .
        if null l
        then 0
        else succ (length (tl l))
```

（为了接下来的讨论方便，我们没有使用等效但更优雅的 `length l = ...` 写法，而是写作 `length = fun l . ...`）

`length` 的类型是 `α list → int`，这是一个泛型类型，因为 `length` 可以对任何类型的列表使用。我们可以使用两种方式来描述我们推导出这一类型的过程。原则上来说，类型检查是通过建立一个由类型约束组成的系统，然后求解这个系统中的类型变量来进行的。实践上来说，类型检查时通过自下而上地甚是整个程序，在走向根部的过程中匹配并综合类型信息来进行的。表达式的类型由子表达式的类型和上下文中的类型约束计算而来，而预定义的标识符则已经包含在初始环境中。我们审视程序并应用匹配的过程并不会影响最终的结果，这是类型系统和类型检查算法的重要特性之一。

`length` 函数的类型约束系统是：

```
[1]   null                       : α list → bool
[2]   tl                         : β list → β list
[3]   0                          : int
[4]   succ                       : int → int

[5]   null l                     : bool
[6]   0                          : γ
[7]   succ (length (tl l))       : γ
[8]   if null l then 0
      else succ (length (tl l))  : γ

[9]   null                       : δ → ε
[10]  l                          : δ
[11]  null l                     : ε

[12]  tl                         : φ → ξ
[13]  l                          : φ
[14]  tl l                       : ξ
[15]  length                     : θ → ι
[16]  tl l                       : θ
[17]  length (tl l)              : ι

[18]  succ                       : κ → λ
[19]  length (tl l)              : κ
[20]  succ (length (tl l))       : λ

[21]  l                          : μ
[22]  if null l then 0
      else succ (length (tl l))  : ν
[23]  fun l . if null l then 0
      else succ (length (tl l))  : μ → ν

[24]  length                     : π
[25]  fun l . if null l then 0
      else succ (length (tl l))  : π
```

[1-4] 行是全局标识符的约束，这我们已经知道了。

> 施工中，请等待施工完成
