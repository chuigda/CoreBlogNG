!!meta-define:ident:asynkronous-and-koroutine.md-2
!!meta-define:title:异步与协程 - 续集
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2023-07-13T20:55:43+08:00
!!meta-define:tags:异步,协程,程序设计语言理论
!!meta-define:brief:本文在上集的基础上，进一步讨论了有栈和无栈协程的实现，并比较了它们的异同与优劣

协程的具体实现总体上和回调式的 API 的实现有异曲同工之妙。简单来说就是，当一个协程需要等待 IO 的时候，
协程会将自己暂时挂起，将控制权交还给协程调度器，这样调度器就能调度另一个没有阻塞、可以运行的协程；
然后把自己挂在 IO 等待队列上，IO 操作完成时，调度器会唤醒正在队列中等待的协程，让它继续执行。

```javascript
function readData(connection) {
    while (true) {
        const data = readDataNonBlocking(connection)
        if (data === null) {
           // 加入等待队列
           addToWaitingQueue(connection, currentTask())
           // 挂起当前协程，将控制权交还给调度器
           suspend()
        }
        
        return data
    }
}
```

显然，在切换协程的过程中，也需要保存/恢复协程代码的上下文。在这种时候，就有两种不同的选择：**有栈（stackful）协程**和**无栈（stackless）协程**。

## 有栈协程

有栈协程的思路非常简单：每创建一个新的协程，就给它开一个新的栈；而在切换协程的时候，只需要切换到对应的栈，然后设置好程序计数器：

```javascript
function launchTask(taskFn) {
    taskId = allocateTaskId()
    stack = createStack()
    
    addToTaskSet({ taskId, taskFn, stack })
    
    return taskId
}

function suspend() {
    nextTask = scheduleNextTask()
    setCurrentStack(nextTask.stack)
    setProgramCounter(nextTask.programCounter)
}
```

有栈协程的实现方式非常简单易懂，并且通常情况下，引入有栈协程不需要改变与 IO 不相关的代码。不过，创建和管理栈需要协程运行时的支持，并且也有一定的性能开销。Golang 和 Julia 都使用有栈协程。

## 无栈协程

与有栈协程相对应地，**无栈协程** 不需要依靠运行时来开辟栈。无栈协程的实现方法是巧妙地将使用了协程的函数变换为**状态机**：

```javascript
function CREATE_CONTEXT_readData(connection) {
    return {
        state: 0,
        connection
    }
}

function POLL_readData(context, waker) {
    data = readDataNonBlocking(context.connection)
    if (data === null) {
        // 当 context.connection 准备就绪的时候，它会通过 waker 通知调度器可以再 poll 一次
        addToWaitingQueue(context.connection, waker)
        return { status: PENDING }
    }
   
    return { status: READY, data }
}

// 这是我们之前传递给 launchTask 的 taskFn
function CREATE_CONTEXT_taskFn(connection) {
    return {
        CONTEXT_readData: CREATE_CONTEXT_readData(connection)
    }
}

function POLL_taskFn(context, waker) {
    status, data = POLL_readData(CONTEXT_readData, waker)
    if (status === PENDING) {
        return { status: PENDING }
    }
    
    processData(data)
    return { status: READY }
}

while (true) {
    connection = acceptConnection()
    launchTask(CREATE_CONTEXT_taskFn(connection), POLL_taskFn)
}
```

通过这样的变换，一个异步函数变成了一个 context 和一个负责推着 context 走的 poll 函数。
异步函数的上下文就被存储在了 context 里，而调度器只需要在 waker 被调用的时候再次尝试 poll 这个 context 即可。
这就免除了对运行时的需求。

*但，古尔丹，代价是什么呢？* 显然，只要一个函数需要调用另一个异步函数，这个函数就必须进行上面的变换，
以保存自己和被调用函数的上下文。反映到代码中，大部分采用无栈协程的语言都要求将异步函数标记为 `async`，
并在调用异步函数的时候使用 `await` 关键字 —— 也就是所谓的**染色**。而最终，我们不得不面临这样一个问题，
那就是只要调用链上有一个异步函数，整个调用链都必须被染色，就像*马洛诺斯之血*一样，无法洗去。

Rust，JavaScript 和 Python 都使用无栈协程。

## 总结

- 对于系列教程讨论的问题而言，程序中的任务总体上可以分为两类：**计算任务** 和 **IO 任务**
- 计算任务带来的时间开销是无法避免的，而 IO 任务的时间开销更多地来自于等待。程序通常希望在 IO 任务不能立即完成时尽可能有活可做，执行其他任务
- 多线程是对此问题最原始的解决方案，但创建多个线程有开销，并且操作系统的调度器对于这种场合并不理想，线程间通信和共享数据也是一个问题
- 为了更高效地解决这个问题，我们引入了非阻塞式的 API
- 非阻塞 API 本身非常难以使用，因此需要封装。回调式 API 是最原始的方式，而协程则是目前为止的“终极解决方案”
- 协程的实现方式有两种：有栈协程和无栈协程。有栈协程的实现原理简单，但需要运行时的支持；无栈协程的不需要运行时，但要进行一系列复杂的变换，还会引入染色问题
- *没有银弹*
