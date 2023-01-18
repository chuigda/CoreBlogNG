import { h } from 'tsx-dom'

import config from '../config'
import './about-page.css'

const {
   blog: {
      name,
      description,
      avatar
   }
} = config

const Index = () => {
   return (
      <div class="index">
         <div class="index-title">
            <h1>{ name }</h1>
            <hr />
         </div>
         <img class="index-avatar" draggable="false" src={avatar} alt="头像" />
         <div class="index-content">
            { description }
         </div>
      </div>
   )
}

export default Index
