from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from datetime import datetime

@require_http_methods(["GET"])
def health(request):
    return JsonResponse({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    })

@require_http_methods(["GET"])
def get_users(request):
    return JsonResponse([
        {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'},
        {'id': 2, 'name': 'Bob', 'email': 'bob@example.com'}
    ], safe=False)

@require_http_methods(["GET"])
def get_user(request, user_id):
    return JsonResponse({
        'id': user_id,
        'name': 'User',
        'email': f'user{user_id}@example.com'
    })

@require_http_methods(["POST"])
def create_user(request):
    import json
    data = json.loads(request.body)
    return JsonResponse({
        'id': 3,
        'name': data.get('name'),
        'email': data.get('email')
    }, status=201)
