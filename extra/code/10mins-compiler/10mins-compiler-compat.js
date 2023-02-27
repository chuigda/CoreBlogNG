function generate(tree_item) {
   if (typeof tree_item == 'number') {
      return tree_item.toString()
   } else if (typeof tree_item == 'object') {
      var operands = []
      for (var i = 0; i < tree_item.operands.length; i++) {
         operands.push(generate(tree_item.operands[i]))
      }

      var ret = '('
      for (var i = 0; i < operands.length; i++) {
         ret += operands[i]
         if (i < operands.length - 1) {
            ret += ' ' + tree_item.operator + ' '
         }
      }
      ret += ')'
      return ret
   } else {
      throw new Error('malformed syntax tree')
   }
}

function choose_reducer(operator) {
   switch (operator) {
      case '+': return function (a, b) { return a + b }
      case '-': return function (a, b) { return a - b }
      case '*': return function (a, b) { return a * b }
      case '/': return function (a, b) { return a / b }
   }
}

function evaluate(tree_item) {
   if (typeof tree_item == 'number') {
      return tree_item
   } else if (typeof tree_item == 'object') {
      var operands = []
      for (var i = 0; i < tree_item.operands.length; i++) {
         operands.push(evaluate(tree_item.operands[i]))
      }

      var reducer = choose_reducer(tree_item.operator)
      var value = operands[0]
      for (var i = 1; i < operands.length; i++) {
         value = reducer(value, operands[i])
      }
      return value
   } else {
      throw new Error('malformed syntax tree')
   }
}

function is_whitespace(char) {
   return char == ' '
      || char == '\r'
      || char == '\n'
      || char == '\t'
      || char == '\f'
      || char == '\v'
}

function is_symbol(char) {
   return char == '('
      || char == ')'
      || char == '+'
      || char == '-'
      || char == '*'
      || char == '/'
}

function is_number(char) {
   return char == '0'
      || char == '1'
      || char == '2'
      || char == '3'
      || char == '4'
      || char == '5'
      || char == '6'
      || char == '7'
      || char == '8'
      || char == '9'
}

function lex_analysis(input) {
   var result = []

   var idx = 0
   while (idx < input.length) {
      if (is_whitespace(input.charAt(idx))) {
         idx += 1
      } else if (input.charAt(idx) == ';') {
         while (idx < input.length && input.charAt(idx) != '\n') {
            idx += 1
         }
      } else if (is_symbol(input.charAt(idx))) {
         result.push(input.charAt(idx))
         idx += 1
      } else if (is_number(input.charAt(idx))) {
         var num = ''
         while (idx < input.length && is_number(input.charAt(idx))) {
            num = num + input.charAt(idx)
            idx += 1
         }

         result.push(parseInt(num))
      } else {
         throw new Error('unexpected character')
      }
   }

   return result
}

function is_operator(char) {
   return char == '+'
      || char == '-'
      || char == '*'
      || char == '/'
}

function parse_expr(context, tokens) {
   var token = tokens[context.idx]
   if (typeof token == 'number') {
      context.idx += 1
      return token
   } else if (token == '(') {
      context.idx += 1
      return parse_compound_expr(context, tokens)
   } else {
      throw new Error('unexpected token')
   }
}

function parse_compound_expr(context, tokens) {
   var operator = tokens[context.idx]
   if (!is_operator(operator)) {
      throw new Error('unexpected token')
   }

   var operands = []
   context.idx += 1
   while (context.idx < tokens.length && tokens[context.idx] != ')') {
      var operand = parse_expr(context, tokens)
      operands.push(operand)
   }

   if (context.idx == tokens.length) {
      throw new Error('unexpected end of input')
   } else {
      context.idx += 1
      return {
         operator: operator,
         operands: operands
      }
   }
}

var tokens = lex_analysis(
   '(* (+ 3 4)    ; 分号后面是注释啦\n' +
   '   (- 5 2 1)) ; 这里故意换了一行'
)
console.log('tokens = ' + JSON.stringify(tokens))

var tree = parse_expr({ idx: 0 }, tokens)
console.log('tree = ' + JSON.stringify(tree, null, 3))

var generated = generate(tree)
console.log('generated = \'' + generated + '\'')
console.log('eval(generated) = ' + eval(generated)) // very sorry!

var evaluated = evaluate(tree)
console.log('evaluate(tree) = ' + evaluated)
