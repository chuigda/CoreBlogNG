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



> 施工中，请等待施工完成