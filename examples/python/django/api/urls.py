from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('api/users/', views.get_users, name='get_users'),
    path('api/users/<int:user_id>/', views.get_user, name='get_user'),
    path('api/users/create/', views.create_user, name='create_user'),
]
