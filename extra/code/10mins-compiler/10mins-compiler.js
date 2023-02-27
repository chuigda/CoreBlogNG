const generate = tree_item => {
   if (typeof tree_item === 'number') {
      return `${tree_item}`
   } else if (typeof tree_item === 'object') {
      const operands = tree_item.operands.map(generate)
      return '(' + operands.join(` ${tree_item.operator} `) + ')'
   } else {
      throw new Error('malformed syntax tree')
   }
}

const choose_reducer = operator => {
   switch (operator) {
      case '+': return (a, b) => a + b
      case '-': return (a, b) => a - b
      case '*': return (a, b) => a * b
      case '/': return (a, b) => a / b
   }
}

const evaluate = tree_item => {
   if (typeof tree_item === 'number') {
      return tree_item
   } else if (typeof tree_item === 'object') {
      const operands = tree_item.operands.map(evaluate)
      const reducer = choose_reducer(tree_item.operator)
      return operands.reduce(reducer)
   } else {
      throw new Error('malformed syntax tree')
   }
}

const is_whitespace = char => ' \r\n\t\f\v'.includes(char)

const is_symbol = char => '()+-*/'.includes(char)

const is_number = char => '0123456789'.includes(char)

const lex_analysis = input => {
   const result = []

   let idx = 0
   while (idx < input.length) {
      if (is_whitespace(input[idx])) {
         idx += 1
      } else if (input[idx] === ';') {
         while (idx < input.length && input[idx] !== '\n') {
            idx += 1
         }
      } else if (is_symbol(input[idx])) {
         result.push(input[idx])
         idx += 1
      } else if (is_number(input[idx])) {
         let num = ''
         while (idx < input.length && is_number(input[idx])) {
            num = num + input[idx]
            idx += 1
         }

         result.push(parseInt(num))
      } else {
         throw new Error(`invalid character ${input[idx]}`)
      }
   }

   return result
}

const is_operator = char => '+-*/'.includes(char)

const parse_expr = (context, tokens) => {
   const token = tokens[context.idx]
   if (typeof token === 'number') {
      context.idx += 1
      return token
   } else if (token === '(') {
      context.idx += 1
      return parse_compound_expr(context, tokens)
   } else {
      throw new Error('syntax error')
   }
}

const parse_compound_expr = (context, tokens) => {
   const operator = tokens[context.idx]
   if (!is_operator(operator)) {
      throw new Error('syntax error')
   }
   const operands = []

   context.idx += 1
   while (context.idx < tokens.length && tokens[context.idx] !== ')') {
      const operand = parse_expr(context, tokens)
      operands.push(operand)
   }

   if (context.idx === tokens.length) {
      throw new Error('syntax error')
   } else {
      context.idx += 1
      return { operator, operands }
   }
}


const tokens = lex_analysis(
   '(* (+ 3 4)    ; 分号后面是注释啦\n' +
   '   (- 5 2 1)) ; 这里故意换了一行'
)
console.log(`tokens = ${JSON.stringify(tokens)}`)

const tree = parse_expr({ idx: 0 }, tokens)
console.log(`tree = ${JSON.stringify(tree, null, 3)}`)

const generated = generate(tree)
console.log(`generated = '${generated}'`)
console.log(`eval(generated) = ${eval(generated)}`) // very sorry!

console.log(`evaluate(tree) = ${evaluate(tree)}`)
