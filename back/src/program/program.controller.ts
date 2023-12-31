import { Body, Controller, Get, Post } from '@nestjs/common';
import { ExecInputDto } from './dto/exec-input.dto';
import { HttpService } from '@nestjs/axios';
import { WandboxOutputDto } from './dto/wandbox-output.dto';
import { lastValueFrom, map } from 'rxjs';
import { ErrorResolveInputDto } from './dto/error-resolve-input.dto';
import { ErrorResolveTableDto } from './dto/error-resolve-table.dto';
import { ErrorResolveMethodsDto } from './dto/error-resolve-methods.dto';
import { CheckMissInputDto } from './dto/check-miss-input.dto';
import { MissTableDto } from './dto/miss-table.dto';
import { FindMissesDto } from './dto/find-misses.dto';

@Controller('program')
export class ProgramController {
  constructor(private readonly httpService: HttpService) {}

  @Get('hello')
  hello(): { message: string } {
    return { message: 'hello program api!' };
  }
  @Post('exec')
  async execCode(@Body() execInputDto: ExecInputDto) {
    const code = execInputDto.code;
    const input = execInputDto.input;

    let bodyData;
    if (input == 'none') {
      bodyData = {
        code: code,
        options: 'warning,gnu++1y',
        compiler: 'gcc-13.2.0-c',
        'compiler-option-raw': '-Dx=hogefuga\n-O3',
      };
    } else {
      bodyData = {
        code: code,
        stdin: input,
        options: 'warning,gnu++1y',
        compiler: 'gcc-13.2.0-c',
        'compiler-option-raw': '-Dx=hogefuga\n-O3',
      };
    }

    const url = 'https://wandbox.org/api/compile.json';
    const bodyObj = JSON.stringify(bodyData);
    let result: WandboxOutputDto;

    try {
      result = await lastValueFrom(
        this.httpService
          .post(url, bodyObj)
          .pipe(map((response) => response.data)),
      );
    } catch (e) {
      console.log(e.response);
      return { error: e.response };
    }

    //結果によって返すものを変える
    if (result.status == '0') {
      return { status: 'success', error: [] };
    } else {
      //エラーごとに分割して配列に格納
      let errors: string[] = [];
      console.log('ローデータ：' + result.compiler_error);
      result.compiler_error.split('prog.c:').forEach((value, index) => {
        console.log(index + '番目：' + value);
        if (value.match(/\d+:\d+:/)) {
          console.log(index + '番目を処理');
          console.log(value);
          errors.push(value);
        }
      });
      return { status: 'error', error: errors };
    }
  }

  @Post('/error-resolve')
  errorResolve(@Body() errorResolveDto: ErrorResolveInputDto) {
    const errors: string[] = errorResolveDto.errors;
    let resolveMethods: ErrorResolveMethodsDto[] = [];
    //変更場所: エラーのパターンや説明を追加するにはここを編集する
    const errorTable: ErrorResolveTableDto[] = [
      {
        pattern: /expected '\S+' before '\S+'/,
        description:
          '{position}の前に、{name}があるはずですが、忘れているようです。',
        resolveMethod: '{position}の前に、{name}を追加してください。',
        replaceList: ['name', 'position'],
      },
      {
        pattern: /expected declaration or statement at end of input/,
        description: '閉じの中カッコの数が足りません。',
        resolveMethod:
          '開きカッコと閉じカッコの対応が取れているか確認してください。',
        replaceList: [],
      },
      {
        pattern: /implicit declaration of function '\S+'; did you mean '\S+'? /,
        description:
          '宣言されていない関数{name1}を使おうとしています。{name2}の間違いですか？',
        resolveMethod:
          '関数{name1}を宣言するか、正しい関数名{name2}に直してください。',
        replaceList: ['name1', 'name2'],
      },
      {
        pattern: /implicit declaration of function '\S+' /,
        description: '宣言されていない関数{name}を使おうとしています。',
        resolveMethod: '関数{name}を宣言するか、正しい関数名に直してください。',
        replaceList: ['name'],
      },
      {
        pattern: /\S+: No such file or directory/,
        description: '{name}は存在しないファイルです。',
        resolveMethod:
          '{name}というファイルを作成するか、正しいファイル名（パス）に直してください',
        replaceList: ['name'],
      },
      {
        pattern: /incompatible implicit declaration of built-in function '\S+'/,
        description: '{name}は存在しないファイルです。',
        resolveMethod:
          '{name}というファイルを作成するか、正しいファイル名（パス）に直してください',
        replaceList: ['name'],
      },
      {
        pattern: /undeclared/,
        description: '宣言されていない変数{name}を使おうとしています。',
        resolveMethod: '変数{name}を宣言するか、正しい変数名に直してください。',
        replaceList: ['name'],
      },
      {
        pattern: /suggest parentheses around assignment used as truth value/,
        description: '真理値として使用される代入を括弧で囲むことを提案します',
        resolveMethod: '等しいかの比較には=ではなく、==を使用します。',
        replaceList: [],
      },
      {
        pattern: /'\S+' is used uninitialized/,
        description: '{name}が初期化されずに使用されています。',
        resolveMethod:
          '{name}を初期化してから加算やインクリメントをしてください。',
        replaceList: ['name'],
      },
      {
        pattern:
          /format '\S+' expects argument of type '\S+', but argument 2 has type '\S' /,
        description:
          'フォーマットの{type1}は{type2}型の値を出すためのものですが、実際に渡されているものは{type3}型です。',
        resolveMethod: '扱う方を揃えてください。。',
        replaceList: ['type1', 'type2', 'type3'],
      },
      {
        pattern: /too few arguments to function '\S+'/,
        description: '関数{name}に渡す引数が足りません。',
        resolveMethod:
          '関数{name}に渡す必要がある引数を確認して、それを追加してください。',
        replaceList: ['name'],
      },
      {
        pattern: /too many arguments to function '\S+'/,
        description: '関数{name}に渡す引数が多すぎます。',
        resolveMethod:
          '関数{name}に渡す必要がある引数を確認して、必要のない引数を消してください。',
        replaceList: ['name'],
      },
      {
        pattern:
          /format '\S+' expects argument of type '\S+', but argument 2 has type '\S+'/,
        description:
          'フォーマットの{type1}は{type2}型の値を出すためのものですが、実際に渡されているものは{type3}型です。',
        resolveMethod:
          '{type2}の値を出すつもりでない場合は、渡す変数の型{type3}に合わせて、フォーマットの{type1}を変更してください。',
        replaceList: ['type1', 'type2', 'type3'],
      },
    ];
    //全てのエラーに対して、errorTableに該当するものがあるかを確認する
    const placeTmp = /:/; //行と列の場所を取り出すためのテンプレ
    errors.map((errorStr) => {
      if (
        errorStr != '' &&
        (errorStr.match(/error/) || errorStr.match(/warning/))
      ) {
        const place = errorStr.split(placeTmp);
        let findFlag: boolean = false;
        //パターンに一致するかどうか見る
        errorTable.map((checkError) => {
          if (errorStr.match(checkError.pattern)) {
            console.log('エラーを発見しました');
            //エラー文と説明文、解決方法の文をreplaceNameに渡し、{name}を置き換える
            const [newErrorStr, newDescription, newMethod] = this.replaceName(
              errorStr,
              checkError.description,
              checkError.resolveMethod,
              checkError.replaceList,
            );
            const method: ErrorResolveMethodsDto = {
              error: newErrorStr,
              row: Number(place[0]),
              column: Number(place[1]),
              description: newDescription,
              method: newMethod,
            };
            resolveMethods.push(method);

            findFlag = true;
          }
        });
        if (!findFlag) {
          const method: ErrorResolveMethodsDto = {
            error: errorStr,
            row: Number(place[0]),
            column: Number(place[1]),
            description: 'まれなエラーが発生しています。',
            method: 'TAに尋ねてみてください。',
          };
          resolveMethods.push(method);
        }
      }
    });
    return { resolve: resolveMethods };
  }

  @Post('check-miss')
  checkMiss(@Body() checkMissInputDto: CheckMissInputDto) {
    const code = checkMissInputDto.code;
    let findMisses: FindMissesDto[] = [];
    const missTable: MissTableDto[] = [
      {
        pattern: /if (\S+=\S+)/,
        description: 'ifで等しいかを判定するには、=ではなく==を使用します。',
      },
      {
        pattern: /if(\S+=\S+)/,
        description: 'ifで等しいかを判定するには、=ではなく==を使用します。',
      },
      {
        pattern: /for (\S+);/,
        description: 'for文の括弧の直後に;があります。',
      },
      {
        pattern: /for(\S+);/,
        description: 'for文の括弧の直後に;があります。',
      },
    ];
    //コードの行ごとにミスが含まれるかを確かめる
    const splitCode: string[] = code.split('\\n');
    splitCode.map((row, index) => {
      missTable.map((miss) => {
        if (row.match(miss.pattern)) {
          console.log('missを発見しました');
          const findMiss: FindMissesDto = {
            row: index + 1,
            column: 0,
            description: miss.description,
          };
          findMisses.push(findMiss);
        }
      });
    });
    return { misses: findMisses };
  }

  //エラー文と説明文、解決方法の文を受け取って、{name}を置き換える
  replaceName(
    error: string,
    description: string,
    method: string,
    replaceList: string[],
  ): string[] {
    if (replaceList.length == 0) {
      return [error, description, method];
    }
    //受け取ったerrorから、''で囲まれた文字列をすべて取り出す
    const nameTmp = /'\S+'/g;
    const nameList = error.match(nameTmp);
    if (nameList == null) {
      return [error, description, method];
    }

    console.log('nameListは: ' + nameList);

    //全てを置き換える。それぞれのnameを、replaceListが持っている場所に置き換える
    nameList.map((name) => {
      const replaceName = '{' + replaceList[nameList.indexOf(name)] + '}';
      console.log(replaceName + 'を' + name + 'に置き換えます');
      description = description.replace(replaceName, name);
      method = method.replace(replaceName, name);
      console.log(
        '置き換え後の説明文と解決方法文: ' + description + ' ' + method,
      );
    });

    /*const name = error.match(nameTmp)[0];
    const errorStr = error.replace('{name}', name);
    const descriptionStr = description.replace('{name}', name);
    const methodStr = method.replace('{name}', name);
    console.log(
      '置き換え後の説明文と解決方法文: ' + descriptionStr + ' ' + methodStr,
    );*/
    return [error, description, method];
  }
}
