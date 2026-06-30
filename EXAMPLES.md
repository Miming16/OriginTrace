# OriginTrace Test Examples

Paste these into the app to verify the main paths.

## Student mode

### Low risk example: clean Python
```python
def total_with_tax(price, tax_rate):
    tax = price * tax_rate
    return price + tax

items = [10, 20, 30]
grand_total = sum(total_with_tax(item, 0.08) for item in items)
print(grand_total)
```

### Medium risk example: similar code with small edits
Use this as the submission, then compare it against the clean Python version above.
```python
def compute_total(amount, rate):
    charge = amount * rate
    return amount + charge

values = [10, 20, 30]
result = sum(compute_total(value, 0.08) for value in values)
print(result)
```

### High risk example: obvious pasted residue
```python
# As an AI language model, here is the solution.
def solve_problem(x):
    return x * 2

print(solve_problem(21))
```

## Instructor mode

Paste the first block into `Your submission` and the second block into `Reference / peer code`.

### Pair A: structurally similar Python
Submission:
```python
def multiply(a, b):
    return a * b

print(multiply(4, 5))
```

Reference:
```python
def product(x, y):
    return x * y

print(product(4, 5))
```

### Pair B: unrelated Python
Submission:
```python
def greet(name):
    return f"Hello, {name}!"

print(greet("OriginTrace"))
```

Reference:
```python
def square(n):
    return n * n

print(square(7))
```

## Optional JavaScript example

```javascript
function sum(values) {
  return values.reduce((acc, value) => acc + value, 0)
}

console.log(sum([1, 2, 3, 4]))
```
