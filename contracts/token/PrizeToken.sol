// SPDX-License-Identifier: MIT

/*                                                                
_________   _...._              .--.                __.....__      
\        |.'      '-.           |__|            .-''         '.    
 \        .'```'.    '. .-,.--. .--.           /     .-''"'-.  `.  
  \      |       \     \|  .-. ||  |          /     /________\   \ 
   |     |        |    || |  | ||  |.--------.|                  | 
   |      \      /    . | |  | ||  ||____    |\    .-------------' 
   |     |\`'-.-'   .'  | |  '- |  |    /   /  \    '-.____...---. 
   |     | '-....-'`    | |     |__|  .'   /    `.             .'  
  .'     '.             | |          /    /___    `''-...... -'    
'-----------'           |_|         |         |                    
                                    |_________|                    
*/

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PrizeToken is ERC20 {
  constructor() ERC20("Prize Token", "PRZ") {
    _mint(msg.sender, 1000000000 * 10**decimals());
  }
}
