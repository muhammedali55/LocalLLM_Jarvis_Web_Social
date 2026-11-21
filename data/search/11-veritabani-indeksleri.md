---
title: Veritabanı indeksleri neden önemli?
source: Mimari Defteri
tags: veritabanı, indeks, SQL, SQLite, sorgu, performans
---
İndeks, bir kitabın arkasındaki dizin gibi çalışır: veritabanının aradığı satırı tüm tabloyu taramadan bulmasını sağlar. Büyük tablolarda doğru indeks, saniyeler süren bir sorguyu milisaniyelere indirebilir.

İndeksler genellikle WHERE, JOIN ve ORDER BY ifadelerinde sık kullanılan sütunlara eklenir. Birden fazla sütunu kapsayan bileşik indekslerde sütun sırası önemlidir.

İndekslerin bedeli de vardır: her ekleme ve güncellemede indeksin de güncellenmesi gerekir ve diskte ek yer kaplar. Bu yüzden her sütuna indeks eklemek yerine, yavaş sorgular ölçülmeli ve sorgu planı (örneğin SQLite'ta EXPLAIN QUERY PLAN) incelenerek karar verilmelidir. SQLite, küçük yerel uygulamalar için kurulum gerektirmeyen tek dosyalık bir veritabanı olarak iyi bir seçenektir.
