import { h } from 'tsx-dom'

import config from '../config'
import './about-page.css'

const {
   blog: {
      name,
      description,
      avatar,
      links
   }
} = config

const Index = () => {
   setTimeout(() => {
      $('#dynamicJSONLD').innerHTML = JSON.stringify({
         '@context': 'https://schema.org',
         '@type': 'About',
         'name': `CoreBlogNG about page`,
         'description': `CoreBlogNG about page`
      })
   }, 0)

   return (
      <div class="about">
         <div class="about-title">
            <h1>{ name }</h1>
         </div>
         <img class="avatar" src={avatar} alt="头像" />
         <div class="about-description">
            <hr />
            <div class="about-links">
               {
                  links.map(({icon, text, link}) => (
                     <div>
                        <span class="iconfont">{icon}</span>
                        &nbsp;
                        {link ? <a href={link}>{text}</a> : text}
                     </div>
                  ))
               }
            </div>
            <div class="about-description">
               { description }
            </div>
         </div>
      </div>
   )
}

export default Index
