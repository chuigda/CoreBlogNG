!!meta-define:ident:asynkronous-and-koroutine.md
!!meta-define:title:异步与协程
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-07-12T22:53:43+08:00
!!meta-define:tags:异步,协程,程序设计语言理论
!!meta-define:brief:本文简单地介绍了“异步”与协程的理念，以及它们在程序设计语言中的应用。

在 3202 年，异步和协程已经成为了编程语言中人均必备的装逼手段。
然而一些程序员对于异步和协程一类的理念还是一知半解，本文将会尝试以尽可能简单的方式介绍它们。
受笔者能力所限，本文的介绍非常不形式化，并且往往会在一些需要抽象的时候反而陷入实现相关的具体细节。
不足之处，敬请谅解。

本文中所有代码均为伪代码。

## 阻塞式 API

假设我们有一段代码，它首先从远程计算机获取数据，然后执行一组计算:

```javascript
data = readData(connection)
processData(data)
```

这段代码里涉及了两种任务：
- 从远程计算机获取数据的 `readData` 是一个 **IO 任务**，它并不消耗任何计算资源，只是在等待远程计算机的响应就绪。
- 对数据进行处理的 `processData` 是一个**计算任务**，它消耗本地计算机的 CPU 资源。

在上述代码中，当程序执行到 `readData` 时，如果远程计算机没有响应，那么程序就要停下来等待。对于一个**阻塞式**的
API 来说，它会让线程挂起，将控制权交还给操作系统，让操作系统调度另一个可以执行的线程。 直到数据到来时，
操作系统将线程唤醒，程序才能继续执行。也就是说，这个 API 在等待 IO 时，会**阻塞整个线程的执行**。

那么，如果这段代码属于某个服务程序:

```javascript
while (true) {
    connection = acceptConnection()
    
    data = readData(connection)
    processData(data)
}
```

当一个客户端连接到这个服务程序时，如果这个客户端和服务器之间的网络连接很慢，或是客户端发送的数据很大，
那么整个程序就会卡在 `readData` 上，而无法处理其他客户端的请求。

## 多线程和多进程

在这种情况下，如果一个程序想要尽可能利用计算机上的 CPU 资源，也就是希望**在等 IO 的时候尽量有活可做**，
一种直观的做法就是启动多个线程或者多个进程。这样，当一个线程在等待 IO 的时候，其他线程还可以继续执行。
例如，在上面的服务程序中，我们可以为每个客户端连接启动一个线程:

```javascript
while (true) {
    connection = acceptConnection()
    launchThread(function () {
        data = readData(connection)
        processData(data)
    })
}
```

或者，为每个客户端连接创建一个进程:

```javascript
while (true) {
    connection = acceptConnection()
    if (fork() == 0) {
        data = readData(connection)
        processData(data)
        exit()
    }
}
```

这样，当一个线程被 IO 阻塞时，其他线程还可以继续执行。

## 多线程的局限性

然而，多线程也有它的局限性:
- 创建和维护线程会消耗一定的系统资源
- 当一个线程阻塞时，必须要进入操作系统内核态，切换线程上下文，并且执行线程调度算法
    - 操作系统的线程调度器很强大，但它很大程度上是为“通用”的场景设计的，它只能按照尽可能公平的方式进行调度
- 线程之间进行通信需要使用同步原语，这些东西也有开销，并且容易出错

## 非阻塞的 API

为了解决上述问题，我们可以使用非阻塞的 API。非阻塞的 API 会立即返回，而不是等待 IO 完成:

```javascript
data = readDataNonBlocking()
while (data == null) {
    data = readDataNonBlocking()
}

processData(data)
```

上面的代码使用了一个非阻塞的 API `readDataNonBlocking`，当数据没有准备好时，它会立即返回 `null`。
上面的代码使用轮询的方式来等待数据准备好。不过实际上，我们可以使用更高效的方式来等待数据的到来，
例如 Unix 操作系统会提供一个这样的 `select` API:

```javascript
connections = []

while (true) {
    connection = acceptConnection()
    connections.push(connection)
    
    readyConnections = select(connections) // 从 connections 中选出已经准备好的连接
    if (readyConnections.length > 0) {
        for (connection in readyConnections) {
            data = readData(connection) // 肯定不会阻塞
            processData(data)
        }
    }
}
```

这样的代码就克服了线程的局限性:
- 一个线程可以同时处理多个 IO 任务，每个 IO 任务只占用 `connections` 数组中的一个元素
- 当一个 IO 任务不能推进时，线程可以处理其他 IO 任务
- 所有操作在一个线程之内完成，并且不需要同步原语

## 回调式 API

上面的那个 big while （或称**事件循环**）虽然高效，但毫无疑问它把所有 IO 操作集中在了一起，这就非常地*反封装*。解决这个问题的方式原始之一就是使用回调式 API 对其进行一些封装:

```javascript
readData(connection, function (data) {
    processData(data)
})
```

它的工作方式是这样的:

```javascript
connections = []

function readData(connection, callback) {
    connections.push({
        op: readDataNonBlocking,
        connection: connection,
        callback: callback
    })
}

// 可以认为下面的代码一直在运行，只要 CPU 有空闲，就会执行这些代码
whenCPUIdle(function () {
    readyConnections = select(connections)
    for (connection in readyConnections) {
        op = connection.op
        data = op(connection)
        connection.callback(data)
    }
})
```

回调式的 API 比直接写一个大 while 要好一丢丢，但如果嵌套的多了:

```javascript
readData1(connection, function (data) {
    readData2(connection, function (data) {
        readData3(connection, function (data) {
            processData(data)
            writeData(connection, function () {
                // ...
            })
        })
    })
})
```

就会陷入无尽的回调地狱。因此，我们需要一种更好的方式来组织代码。

## 协程

简单来说，协程就是另一种对 “big while” 的封装方式。有了协程之后，就可以像原先使用同步 API 一样，写出简洁的代码:

```javascript
while (true) {
  connection = acceptConnection()
  launchTask(async function () {
    data = await readData(connection)
    processData(data)
  })
}
```

与原先阻塞式的 `readData` 相比，这里的 `readDataAsync` 并不会阻塞线程，而只是将当前的协程暂停，
控制权会被移交给程序内部的协程调度器，而无须劳烦操作系统。

协程的具体实现总体上和回调式的 API 的实现有异曲同工之妙。*今天先写到这吧，累死我了， 下次再讲 stackful 和 stackless，multithread runtime 和 work stealing，咕咕咕。*
