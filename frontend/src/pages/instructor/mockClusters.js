export const CLUSTERS = [
  {
    id: 1,
    section: 'CS302-A',
    risk: 'High',
    members: ['E. Winters', 'M. Santos', 'P. Torres'],
    matches: [
      {
        memberA: 'E. Winters',
        memberB: 'M. Santos',
        file: 'sorter.c',
        pct: 92,
        left: `void sort(int arr[], int n) {\n  for (int i = 0; i < n; i++) {\n    for (int j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int temp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = temp;\n      }\n    }\n  }\n}`,
        right: `void sort(int arr[], int n) {\n  for (int i = 0; i < n; i++) {\n    for (int j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int temp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = temp;\n      }\n    }\n  }\n}`,
      },
      {
        memberA: 'E. Winters',
        memberB: 'P. Torres',
        file: 'sorter.c',
        pct: 81,
        left: `void sort(int arr[], int n) {\n  for (int i = 0; i < n; i++) {\n    for (int j = 0; j < n - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int temp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = temp;\n      }\n    }\n  }\n}`,
        right: `void sort(int data[], int n) {\n  for (int a = 0; a < n; a++) {\n    for (int b = 0; b < n - a - 1; b++) {\n      if (data[b] > data[b + 1]) {\n        int t = data[b];\n        data[b] = data[b + 1];\n        data[b + 1] = t;\n      }\n    }\n  }\n}`,
      },
    ],
  },
  {
    id: 2,
    section: 'CS101-B',
    risk: 'Medium',
    members: ['S. Connor', 'K. Lim'],
    matches: [
      {
        memberA: 'S. Connor',
        memberB: 'K. Lim',
        file: 'main.py',
        pct: 68,
        left: `def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)`,
        right: `def factorial(num):\n    if num == 0:\n        return 1\n    return num * factorial(num - 1)`,
      },
    ],
  },
];