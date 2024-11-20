---
title: '2021上海 G-Edge Groups(树形dp+数学)'
date: 2022-04-01
use_math: true
permalink: /posts/2013/08/blog-post-2/
tags:
  - cool posts
  - category1
  - category2
---
{% if page.use_math %}  
<script type="text/javascript" id="MathJax-script" async  
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js">  
</script>  
<script>  
  MathJax = {  
    tex: {  
      inlineMath: [['$', '$'], ['\\(', '\\)']],  
      displayMath: [['$$', '$$'], ['\\[', '\\]']],  
      processEscapes: true  
    }  
  };  
</script>  
{% endif %}

# 题目  
有n-1条边(保证为偶数)，分成n-1/2组，每组俩条边，且这俩条边之间要有一个公共点，求方案数

# 解法
我们想到用f[i]代表以i为根的方案数，那么f[i]首先要先乘以v:g[i],f[i]=f[i]*f[v],考虑子方案数的求法

假设当前我们有n条可以自由组合的边，若n为偶数
那么答案要再乘以一个C(n,2)*C(n-2,2)*....*C(2,2) / A(n/2,n/2)

化简这个式子，得到原式=n!/n!! = 1 *3 *5 *...(n-1)

若n为奇数，那么其中一定有一条边是要贡献给其父亲结点的，因为题目保证了边数是偶数，不可能会有奇数的边剩下。

所以我们需要统计对于每个根，其可以自由组合的边有多少条，这个很简单，如果对于子树的某一个节点，其可以自由组合的边数是偶数，那么与其父亲相连的边就可以参与自由组合，反之就不能。这个是很好统计计算的，综上所述就可以得到本题代码了。

反思，自己在写的时候不知道双阶乘的公式，在处理化简式子的时候卡了很久，牢记n!*2^n=(2n)!!

```cpp 
#include<bits/stdc++.h>
#define ll long long
#define int long long
#define INF 0x3f3f3f3f
#define rep(j, a, b) for(int i=a;i<=b;i++)
#define per(j, a, b) for(int i=a;i>=b;i--)
using namespace std;
const int maxn=1e5+5;
const ll mod=998244353;
inline ll read(){ ll f = 1; ll x = 0;char ch = getchar();while(ch>'9'||ch<'0') {if(ch=='-') f=-1; ch = getchar();}while(ch>='0'&&ch<='9') x = (x<<3) + (x<<1) + ch - '0',  ch = getchar();return x*f; }
inline ll qpow(ll a,ll b,ll MOD=mod){ll res=1;a%=MOD;while(b>0){if(b&1)res=res*a%MOD;a=a*a%MOD;b>>=1;}return res;}

vector<int>g[maxn];

ll f[maxn];

ll dfs(int u,int fa)
{
    ll cnt=0;
    f[u]=1;
    for(auto v:g[u])
    {
        if(v==fa) continue;
        //if(g[v].size()&1) cnt++;
        if(!dfs(v,u)) cnt++;
        f[u]=(f[u]%mod*f[v]%mod)%mod;
    }
    for(int i=1;i<=cnt;i+=2) f[u]=(f[u]%mod*i%mod)%mod;
    return (cnt%2)?1:0;//对于子树的某一个节点，其可以自由组合的边数是偶数，那么与其父亲相连的边就可以参与自由组合，反之就不能
}

signed main()
{
    int n=read();
    rep(i,1,n-1)
    {
        int u=read(),v=read();
        g[u].push_back(v);
        g[v].push_back(u);
    }
    dfs(1,0);
    printf("%lld\n",f[1]%mod);
}

```
