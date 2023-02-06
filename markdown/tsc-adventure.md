!!meta-define:ident:tsc-adventure
!!meta-define:title:TypeScript 历险记
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2022-01-20T03:21:00+08:00
!!meta-define:tags:前端,JavaScript,TypeScript
!!meta-define:brief:一个前端菜鸡不信邪，这是他捣鼓了一晚上 TypeScript 编译器的成果

## 前言
众所周知，我，Chuigda WhiteGive，是个前端菜鸡，今天刚刚相对熟练地掌握了 Flex 和 Grid 的使用，而就在两周之前还时常被 CSS 气得半死不活。尽管我经常吹 TypeScript，但我实际上总共只在两年前写过二百来行的 TS 代码，工程经验更是一点没有。所以，本文可能会出现各种离谱错误。

## 起因
前天晚上，群友在群里提问了一个问题：

```typescript
let a = { x: 114 }
a = { x: 114, y: 514 } /* fails */

let b = { x: 114, y: 514 }
a = n /* ok */
```

直接给 `a` 赋值一个字面量，如果字面量中含有原先 `a` 里没有的字段，编译器会报错：

```
Type '{ x: number; y: number; }' is not assignable to type '{ x: number; }'.
Object literal may only specify known properties, and 'y' does not exist in type '{ x: number; }'.
```

而像下面那样，通过一个变量作为“中转”却不会有任何问题。

毫无疑问，类型检查能够给代码带来更多的安全性。但我确实想不明白这个特性是如何设计的。于是我翻了一下 TypeScript 的实现，以及它的 specification。引起报错的是 TypeScript 的特性 Excess Property Check。

## Excess Property Check
想象一下这样一个场景，你有一个 `interface Travel`：

```typescript
interface Travel {
   hotPot?: string,
   singASong?: string
}
```

你尝试创建一个 Travel：

```typescript
const travel: Travel = {
   hotpot: '云之彼端约定的火锅',
   singASong: '打起手来唱起歌，骑着马儿翻山坡'
}
```

但很不幸，你拼错了 `hotPot`。如果这段代码通过编译，因为 `hotPot` 是一个可选的字段，而你没有给它“赋值”，于是它就成为了 `undefined`。吃着火锅唱着歌，突然就被 `undefined` 劫了，造成的心理创伤恐怕不亚于写 C++ 时被 “烫烫烫” 到。

显然，如果有了 Excess Property Check，那么就有机会避免这种情况的发生。不过

## Excess Property Check 的局限性
根据 [TypeScript Specification](https://github.com/microsoft/TypeScript/blob/main/doc/spec-ARCHIVED.md#3115-excess-properties)，这个检查只会在“赋值”右边是 fresh object literal 时候进行。并且，这个检查不会考察“赋值”的左边到底有没有可选字段。这两点加起来就形成了本文一开始的“诡异”局面。

## 我不满意
“没有可选字段也要检查？我不满意。” 于是我就单纯为了满足自己的探索和 NTR 欲望，开始尝试修改 TypeScript 编译器。

我们都知道，在修改编译器的时候有很多种办法可以出老千。例如，在现代一点的编译器架构里，诊断信息一般都是统一管理起来的。TS也不例外，报错信息被放在 [src/compiler/diagnosticMessages.json](https://github.com/microsoft/TypeScript/blob/main/src/compiler/diagnosticMessages.json)。只消修改一下诊断信息的级别，就能选择性地“移除”某些编译错误。但这是不行的，因为这通过编译器选项也可以做到 —— 这本质上没有改变任何东西，没有增强语言的功能，仅仅是站在巨人的肩膀上摘了个苹果，如果传出去一定会被同侪们耻笑。所以我们面对编译器不能选择这种做法。相反，我们必须用外科手术般精确的操作，把特性当中不喜欢的部分给按死。

## 我的 Patch (基于 TypeScript-4.4.3)

```diff
--- a/src/compiler/checker.ts
+++ b/src/compiler/checker.ts
            @@ -17734,6 +17734,10 @@ namespace ts {
                return true;
            }

+            function hasOptionalFields(type: Type): boolean {
+                return getPropertiesOfType(type).some(
+                    member => (member.flags & SymbolFlags.Optional) !== 0
+                );
+            }
+
           /**
            * Compare two types and return
            * * Ternary.True if they are related with no assumptions,


            @@ -17795,7 +17799,10 @@ namespace ts {
                 const isComparingJsxAttributes = !!(getObjectFlags(source) & ObjectFlags.JsxAttributes);
-                const isPerformingExcessPropertyChecks = !(intersectionState & IntersectionState.Target) 
-                    && (isObjectLiteralType(source) 
-                    && getObjectFlags(source) & ObjectFlags.FreshLiteral);
+                const isPerformingExcessPropertyChecks =
+                    !(intersectionState & IntersectionState.Target)
+                    && (isObjectLiteralType(source) && getObjectFlags(source) & ObjectFlags.FreshLiteral)
+                    && hasOptionalFields(target);
                 if (isPerformingExcessPropertyChecks) {
                     if (hasExcessProperties(source as FreshObjectLiteralType, target, reportErrors)) {
                         if (reportErrors) {
```

最后跑出来的效果确实符合我的预期：

```typescript
let foo = { x: 114 };
foo = { x: 114, y: 514 }; // Ok

let senpai: { x: number, y?: number } = { x: 114514 };
senpai = { x: 114, y: 514, z: 1919810 }; // Error

let anya: { x: number, y: number } = { x: 114514, y: 1919810 };
anya = { y: 1414893 };

interface Bar {
   x: number,
   y: number
}

let bar: Bar = { x: 114, y: 514 };
bar = { x: 1919, y: 810, z: 893 }; // Ok

interface Baz {
   x: number
   y?: number
}

let baz: Baz = { x: 5, y: undefined };
baz = { x: 5, y: 4, z: 114514 }; // Error
```

测试项目方面，Project test 全过，然后因为这个 Patch 改变了 Excess Property Check 的语义，所以 Conformance test 挂了一些。我随便看了几个，基本都是符合预期的。因为我不是专业的 TypeScript 程序员，所以就不再深入探索了。

>〚就暂且接受现状 (工程学+500，社会学+500)〛
