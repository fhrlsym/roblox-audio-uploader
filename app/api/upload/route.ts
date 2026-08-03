import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const apiKey = formData.get('apiKey') as string;
    const targetType = formData.get('targetType') as string;
    const targetId = formData.get('targetId') as string;

    if (!file || !apiKey || !targetId) {
      return NextResponse.json(
        { success: false, error: 'Data tidak lengkap' },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const blob = new Blob([fileBuffer], { type: file.type });

    const uploadUrl = targetType === 'user'
      ? `https://apis.roblox.com/assets/v1/assets`
      : `https://apis.roblox.com/assets/v1/assets`;

    const uploadFormData = new FormData();
    uploadFormData.append('request', JSON.stringify({
      assetType: 'Audio',
      displayName: file.name.replace(/\.[^/.]+$/, ''),
      description: 'Uploaded via Roblox Audio Uploader',
      creationContext: {
        creator: {
          [targetType === 'user' ? 'userId' : 'groupId']: targetId
        }
      }
    }));
    uploadFormData.append('fileContent', blob, file.name);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return NextResponse.json(
        { success: false, error: `Upload gagal: ${errorText}` },
        { status: uploadResponse.status }
      );
    }

    const uploadResult = await uploadResponse.json();
    const operationPath = uploadResult.path;

    let assetId = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://apis.roblox.com/assets/v1/operations/${operationPath.split('/').pop()}`,
        {
          headers: {
            'x-api-key': apiKey,
          },
        }
      );

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        
        if (statusResult.done) {
          if (statusResult.response) {
            assetId = statusResult.response.assetId;
            break;
          } else if (statusResult.error) {
            return NextResponse.json(
              { success: false, error: `Moderasi gagal: ${statusResult.error.message}` },
              { status: 400 }
            );
          }
        }
      }

      attempts++;
    }

    if (!assetId) {
      return NextResponse.json(
        { success: false, error: 'Timeout menunggu moderasi' },
        { status: 408 }
      );
    }

    return NextResponse.json({
      success: true,
      assetId: assetId,
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error tidak diketahui' },
      { status: 500 }
    );
  }
}
