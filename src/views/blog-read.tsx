import { h } from 'tsx-dom'

import config from '../config'
import './blog-read.css'

const { api: { base } } = config

// @ts-ignore
const BlogRead = ({ blogId }) => {
   setTimeout(async () => {
      const { title, html, liberal } = await $().get<any>(`${base}/blog/${blogId}`)
      $('#blog-read').style.cssText = ''
      $('#blog-title').innerText = title

      const blogContent = $('#blog-content')
      blogContent.innerHTML = html
      if (liberal) {
         blogContent.classList.add('liberal')
      }
   }, 0)

   return (
      <div id="blog-read" style={{ display: 'none' }}>
         <h1 id="blog-title"></h1>
         <hr />
         <div id="blog-content"></div>
         <div id="blog-footer">&nbsp;</div>
      </div>
   )
}

export default BlogRead
