!!meta-define:ident:ffmpeg-big-bad
!!meta-define:title:FFmpeg 遇坑记
!!meta-define:author:Chuigda WhiteGive
!!meta-define:time:2020-07-03T18:30:00+08:00
!!meta-define:tags:FFmpeg,C,C++,音视频处理
!!meta-define:brief:折腾一下还是挺锻炼个人能力的；但是没文档真的害死人

今天是周一，周一要上班。开开心心走进公司，打开电脑，打开 QtCreator，开始编写基于 FFmpeg 的“多合一”程序。所谓“多合一’，就是把多张图片合成一个视频（音轨就暂时不要辣），并且让这个视频在浏览器上可以直接播放出来（参考 HTML5 新加的 `video` 标签）。 HTML5 的 `<video>` 支持最广泛的格式是：MP4 + H264 视频 + AAC 音频，即使是 IE 都支持这个格式。当前的任务还不需要音频流，所以我只关注视频就可以了。

在这次任务中，我被要求使用一个看起来还不错（其实确实不错，就是后面你们就知道了）的 [FFmpeg库](ffmpeg.org)。之所以不用其他库是因为我没得选，视频处理仅此一家（后来发现另一家 GStreamer 还不如这个）。于是我就开始写了，在写的时候就与到了一堆问题。

## 1. 文档呢？我文档呢？

如果说 scikit-image 的文档是极其匿乏，那么FFopeg简直就是意识流文档，说是皇帝的新文档也不过分。当我打开 [FFmpeg 官网的文档页面](https://ffmpeg.org/documentation.html) 看到 Libraries Documentation 的时候，我差点都要激动得跳起来了。然而当我点开其中每一个主题，发现这些文档都只有三部分：Description, See Also 和 Authors，而且Authors 还是占比最多的那个。 除开这个毫无用处的 Libraries Docuoectation, 剩下的就是官方 wiki、一个第三方教程和一堆 Doxygen 文档了。[官方网站上附带的那个第三方教程](dragster.org/ffmpeg)最后更新于 2015 年，其中的很多写法已经被淘汰了；而 wiki 也给不了太多有用的信息。至于 Doxygen 文档 —— 见鬼去吧，谁会一入门就看这玩意。好在我借助搜索引擎找到了一份[还算新而且友好的教程](https://github.com/leandromoreira/ffmpeg-libav-tutorial) ,配合[官方的例子](https://ffmpeg.org/doxygen/trunk/examples.html) 勉强学会了基本操作。

## 2. 我的头呢？

因为要把多张图片聚合成一个视频，我首先选择了官网上的 [encode_video 例子](https://ffmpeg.org/doxygen/trunk/encode_video_8c-example.html)，一板一眼地抄了起来。为了方便测试，我在内存里创建填充图像用了 RGB 格式，但 H264 视频要求 YUV 格式，所以我又参考 [Stackoverflow 上的例子](https://stackoverflow.com/questions/16667687/how-to-convert-rgb-from-yuv420p-for-ffmpeg-encoder) 用 libswscale 写了个转码。最后的结果还不错，视频是成功生成了。然而，生成的视频并不能在浏览器上播放。事实上，除了 Manjaro 自带的视频查看器（它大概读入了视频的前几帧来判定了文件类型），别的工具都打不开它。

对比另外一个官方例子 remuxing (https://ffmpeg.org/doxygen/trunk/remuxing_8c-example.html)，我发现了问题所在：我像 encode 例子一样直接从 `AVCodecContext` 编码出的`AVPacket` 里取出了原始数据，把它们一股脑写入文件。但是通常来说，视频文件（或称“容器”）需要一个头部和一个尾部来记录必要的格式信息。在一番折腾之后，我终于写出了能正确输出头部信息的版本。然而

## 3. 怎么就不能播放了呢？ 

然而问题从所有的播放器都打不开它，变成了所有的播放器都播放不了它。我用我自己仿照官方教程写的元信息导出工具分析了一下，发现视频的 `duration` 只有几百 ms —— 换而言 之，并不是‘播放不了”，而是视频的时间太短了，一闪而过了而已。

可是我已经设置 `AVCodecContext::time_base`和 `AVCodecContext::framerate` 了呀，
以 25fps 的速度播放这个视频，应该够看的才对呀？这个时候，输出信息里的一个细节引起了我的注意：

```
AVStream::time_base 1/90000 AVStream->r_frame_rate 90000/1
```

也就是说实际的帧率达到了 90000 fps！难怪会一闪而过。但为什么我的设置会被覆盖呢？

## 4. “帧率”究竟是什么

查阅了一些官方文档，我才了解到“帧率”这个说法在视频处理中早就不流行了。事实上，`AVStream->r_frame_rate` 是一个运行的时候才计算出来的数值，而 `AVCodecContext::framerate` 起到的仅仅是“建议”作用 —— FFmpeg 可能听你的，也可能直接无视。

现代视频的帧率实际上是由每一帧的 PTS(Presentation Time Stamp) 来决定的，也就是说现代视频规定的是某一帧什么时候显示出来，而不是以多快的速度播放帧。这也允许视频的“帧率”随时变动。但是即便如此，某一帧实际展示的时间应该等于 `time_base * PTS`。我也是设置了 `AVStream::time_base` 的。在搜索一番之后我发现了 [这个issue](https://trac.ffmpeg.org/ticket/2658)。简单来说，MP 系列格式的 `time_base` 是被锁定到 `1/90000` 的，我之后的 debug 也验证了这一点。既然 `time_base` 无法改变，那就只好朝 PTS 下手了。通过设置 PTS 为 1500 的倍数，我最终得到了一个婴儿皮肤般丝滑的 60 帧视频。

## 5. 后记

感觉这样折腾一下还是挺锻炼个人能力的；但是没文档真的害死人
