import { h } from 'tsx-dom'
import dayjs from 'dayjs'

import config from '../config'
import './blog-list.css'

const { api: { base } } = config

// @ts-ignore
const BlogList = ({ liberal }) => {
   setTimeout(async () => {
      const blogs = await $().get(`${base}/list/${liberal ? 'liberal' : 'tech'}`)
      // @ts-ignore
      blogs.forEach(({ title, brief, time, timestamp, ident, author }) => {
         $('#blog-list').appendChild(
            <div class="blog-item">
               <h2><a href={`/#/blog/${timestamp}-${ident}`}>{title}</a></h2>
               <div class="brief">{brief}</div>
               <div class="author-line">由 <b>{author}</b> 发布于 { dayjs(time).format('YYYY 年 M 月 D 日 HH:mm:ss') }</div>
            </div>
         )
      })
   }, 0)

   return (
      <div id="blog-list">

      </div>
   )
}

export default BlogList
