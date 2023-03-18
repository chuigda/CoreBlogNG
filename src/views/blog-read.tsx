import { h } from 'tsx-dom'

import config from '../config.json'
import './blog-read.css'
import dayjs from "dayjs";

const { api: { base } } = config

// @ts-ignore
const BlogRead = ({ blogId }) => {
   setTimeout(async () => {
      const { author, time, title, brief, html, liberal } = await $().get<any>(`${base}/blog/${blogId}`)
      $('#blog-read').style.cssText = ''
      $('#blog-title').innerText = title

      const blogContent = $('#blog-content')
      blogContent.innerHTML = html
      if (liberal) {
         blogContent.classList.add('liberal')
      }

      $('#dynamicJSONLD').innerHTML = JSON.stringify({
         '@context': 'https://schema.org',
         '@type': 'Blog',
         'name': title,
         'description': brief,
         'author': {
            '@type': 'Person',
            'name': author
         },
         'datePublished': dayjs(time).format('YYYY-MM-DD')
      })
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
