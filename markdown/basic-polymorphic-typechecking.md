!!meta-define:ident:basic-polymorphic-typechecking
!!meta-define:title:Basic polymorphic typechecking
!!meta-define:author:Luca Cardelli
!!meta-define:time:1984-01-01T00:00:00+08:00
!!meta-define:tags:编译器,Java,程序设计语言理论,类型系统
!!meta-define:brief:Chuigda 对 1984 年 Luca Cardelli 论文 [Basic polymorphic typechecking](http://lucacardelli.name/Papers/BasicTypechecking%20(TR%201984).pdf) 的翻译。

## 0. 前言

本文是对 1984 年 Luca Cardelli 论文 [Basic polymorphic typechecking](http://lucacardelli.name/Papers/BasicTypechecking%20(TR%201984).pdf) 的翻译，并且使用 Java 重写了论文中的例子，避免 ML 的语法对读者造成困扰。

记仇时刻：

<div class="img-container">
<img src="/extra/blog-images/chuigda-doesnt-learn-jvav.jpg" alt="Chuigda 不学 Jvav" width="540" height="169"/>
</div>

> 施工中，请等待施工完成