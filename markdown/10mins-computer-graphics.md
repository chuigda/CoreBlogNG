!!meta-define:ident:10-minutes-computer-graphics
!!meta-define:title:十分钟计算机图形学
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-07-26T22:30:15+08:00
!!meta-define:tags:图形学,软件渲染器,Julia
!!meta-define:brief:七通设计算机图形学与 Vk 入门专用教材，你还在等什么，<del>赶紧拨打热线电话订购吧！</del>
!!meta-define:hidden:true


计算机图形学，从应用的角度上来说，其实是一种非常简单的技术。不幸的是，现有的教程通常会在一开始拘泥于一些数学上的问题，或者执着于一些数学上的细节。本教程尝试通过另一种方式，借由一个基本软件渲染器的实现，概览整个渲染管线，来介绍计算机图形学的基本概念。

## 计算机图形学

简单来说，计算机图形学的*意图*就是将一系列的图元（点、线、三角形，以及它们的空间位置、颜色属性）转化为屏幕上的像素点。这个转换的过程被称为*渲染*。

本教程中，我们会使用 Julia 实现一个基本的软件渲染器，它能*光栅化*基本的三角形图元，并且能够以*可编程*的方式配置一部分渲染管线。

## 准备工作