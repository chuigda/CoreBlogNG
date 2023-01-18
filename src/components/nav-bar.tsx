import { h } from 'tsx-dom'

import './nav-bar.css'

const NavLink = ({ hashLink, children }) => (
   <div class="nav-item" onClick={() => window.location.hash = hashLink}>
      {children}
   </div>
)

const NavBar = () => {
   return (
      <div class="nav">
         <NavLink hashLink="/"><span>隨想</span></NavLink>
         <NavLink hashLink="/tech"><span>技術</span></NavLink>
         <NavLink hashLink="/about"><span>關於</span></NavLink>
         <NavLink hashLink="/link"><span>友鏈</span></NavLink>
      </div>
   )
}

export default NavBar
