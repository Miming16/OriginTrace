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
        file: 'Sorter.java',
        pct: 92,
        left: `public void sort(int[] arr) {\n  for (int i = 0; i < arr.length; i++) {\n    for (int j = 0; j < arr.length - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int temp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = temp;\n      }\n    }\n  }\n}`,
        right: `public void sort(int[] arr) {\n  for (int i = 0; i < arr.length; i++) {\n    for (int j = 0; j < arr.length - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int temp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = temp;\n      }\n    }\n  }\n}`,
      },
      {
        memberA: 'E. Winters',
        memberB: 'P. Torres',
        file: 'Sorter.java',
        pct: 81,
        left: `public void sort(int[] arr) {\n  for (int i = 0; i < arr.length; i++) {\n    for (int j = 0; j < arr.length - i - 1; j++) {\n      if (arr[j] > arr[j + 1]) {\n        int temp = arr[j];\n        arr[j] = arr[j + 1];\n        arr[j + 1] = temp;\n      }\n    }\n  }\n}`,
        right: `public void sort(int[] data) {\n  for (int a = 0; a < data.length; a++) {\n    for (int b = 0; b < data.length - a - 1; b++) {\n      if (data[b] > data[b + 1]) {\n        int t = data[b];\n        data[b] = data[b + 1];\n        data[b + 1] = t;\n      }\n    }\n  }\n}`,
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
